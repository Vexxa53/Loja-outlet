"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { siteUrl } from "../env";
import { isRateLimited, rateLimit, recordHit } from "../rate-limit";
import { TENANT_COOKIE, getMemberships, safeNext } from "../auth/context";
import { clientIp } from "./helpers";
import { fail, formToObject, success, zodFail, type ActionState } from "../validation/common";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha.").max(200),
});

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const { email, password } = parsed.data;

  // Só FALHAS contam para o limite (por IP e por e-mail), para frear tentativa de adivinhar senha.
  const ip = await clientIp();
  const ipKey = `login-fail:${ip}`, mailKey = `login-fail:${email.toLowerCase()}`;
  if (isRateLimited(ipKey, 30) || isRateLimited(mailKey, 8)) {
    return fail("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    recordHit(ipKey, 15 * 60_000); recordHit(mailKey, 15 * 60_000);
    // mensagem única: não revela se o e-mail existe
    return fail(error.status === 429 ? "Muitas tentativas. Aguarde um pouco." : "E-mail ou senha incorretos.");
  }
  redirect(safeNext(fd.get("next")?.toString()));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(TENANT_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email("Informe um e-mail válido.") }).safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 5, 15 * 60_000)) return fail("Muitas solicitações. Tente novamente mais tarde.");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/redefinir`,
  });
  // resposta idêntica exista ou não a conta
  return success("Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.");
}

export async function updatePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(72), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] })
    .safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("O link expirou. Solicite a redefinição novamente.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("Não foi possível alterar a senha. Escolha uma senha diferente e mais forte.");
  redirect("/admin");
}

export async function switchTenant(fd: FormData) {
  const id = fd.get("tenantId")?.toString();
  const memberships = await getMemberships();
  if (id && memberships.some((m) => m.tenant.id === id)) {
    (await cookies()).set(TENANT_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  redirect("/admin");
}
