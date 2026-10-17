"use server";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordError, requireCustomer, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { sendMail } from "@/lib/mail";

type State = { error?: string; ok?: string } | undefined;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const email = z.string().trim().toLowerCase().email().max(160);

export async function register(_: State, fd: FormData): Promise<State> {
  const p = z.object({ name: z.string().trim().min(3).max(120), email, password: z.string().max(200), phone: z.string().trim().max(20).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Verifique nome, e-mail e senha." };
  const pe = passwordError(p.data.password);
  if (pe) return { error: pe };
  if (!(await rateLimit(`register:${await clientIp()}`, 10, 3600))) return { error: "Muitas tentativas. Tente mais tarde." };
  if (await db.customer.findUnique({ where: { email: p.data.email } })) return { error: "Não foi possível cadastrar com este e-mail. Tente entrar ou recuperar a senha." };
  const c = await db.customer.create({ data: { name: p.data.name, email: p.data.email, phone: p.data.phone || null, passwordHash: await hashPassword(p.data.password) } });
  await createSession("customer", c.id);
  redirect("/conta");
}

export async function login(_: State, fd: FormData): Promise<State> {
  const p = z.object({ email, password: z.string().max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "E-mail ou senha inválidos." };
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}:${p.data.email}`, 8, 900)) || !(await rateLimit(`login-ip:${ip}`, 40, 900))) return { error: "Muitas tentativas. Aguarde 15 minutos." };
  const c = await db.customer.findUnique({ where: { email: p.data.email } });
  const ok = c?.passwordHash && !c.anonymizedAt && (await verifyPassword(p.data.password, c.passwordHash));
  if (!c || !ok) return { error: "E-mail ou senha inválidos." };
  await createSession("customer", c.id);
  redirect("/conta");
}

export async function logout() {
  await destroySession("customer");
  redirect("/");
}

export async function requestReset(_: State, fd: FormData): Promise<State> {
  const p = email.safeParse(fd.get("email"));
  const generic = { ok: "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação." };
  if (!p.success) return generic;
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 3600))) return generic;
  const c = await db.customer.findUnique({ where: { email: p.data } });
  if (c && !c.anonymizedAt) {
    const token = randomBytes(32).toString("hex");
    await db.passwordReset.create({ data: { customerId: c.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600_000) } });
    const url = `${process.env.BASE_URL ?? ""}/conta/redefinir/${token}`;
    await sendMail(c.email, "Redefinição de senha", `<p>Para criar uma nova senha, acesse (válido por 1 hora):</p><p><a href="${url}">${url}</a></p>`);
  }
  return generic;
}

export async function resetPassword(_: State, fd: FormData): Promise<State> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const pe = passwordError(password);
  if (pe) return { error: pe };
  const r = await db.passwordReset.findUnique({ where: { tokenHash: sha(token) } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return { error: "Link inválido ou expirado." };
  const hash = await hashPassword(password);
  const used = await db.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return { error: "Link inválido ou expirado." };
  await db.customer.update({ where: { id: r.customerId }, data: { passwordHash: hash } });
  redirect("/conta/entrar?redefinida=1");
}

export async function updateProfile(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  const p = z.object({ name: z.string().trim().min(3).max(120), phone: z.string().trim().max(20).optional(), cpf: z.string().trim().max(14).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Dados inválidos." };
  await db.customer.update({ where: { id: c.id }, data: { name: p.data.name, phone: p.data.phone || null, cpf: p.data.cpf || null } });
  revalidatePath("/conta");
  return { ok: "Dados atualizados." };
}

const addr = z.object({
  recipient: z.string().trim().min(3).max(120), zip: z.string().regex(/^\d{5}-?\d{3}$/), street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20), complement: z.string().trim().max(80).optional(), district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80), state: z.string().trim().length(2).toUpperCase(),
});

export async function saveAddress(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  const p = addr.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Verifique os campos do endereço." };
  const id = String(fd.get("id") ?? "");
  const data = { ...p.data, zip: p.data.zip.replace(/\D/g, ""), complement: p.data.complement || null };
  if (id) {
    const r = await db.address.updateMany({ where: { id, customerId: c.id }, data }); // escopo pelo dono
    if (r.count === 0) return { error: "Endereço não encontrado." };
  } else {
    const first = (await db.address.count({ where: { customerId: c.id } })) === 0;
    await db.address.create({ data: { ...data, customerId: c.id, isDefault: first } });
  }
  revalidatePath("/conta/enderecos");
  return { ok: "Endereço salvo." };
}

export async function deleteAddress(fd: FormData) {
  const c = await requireCustomer();
  await db.address.deleteMany({ where: { id: String(fd.get("id")), customerId: c.id } });
  revalidatePath("/conta/enderecos");
}

export async function privacyRequest(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  const kind = String(fd.get("kind"));
  if (!["ACCESS", "DELETE", "CORRECTION"].includes(kind)) return { error: "Solicitação inválida." };
  await db.privacyRequest.create({ data: { customerId: c.id, email: c.email, kind, note: String(fd.get("note") ?? "").slice(0, 500) } });
  return { ok: "Solicitação registrada. Responderemos conforme a LGPD." };
}
