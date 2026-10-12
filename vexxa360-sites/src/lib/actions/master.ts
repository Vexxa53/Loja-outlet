"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "../supabase/admin";
import { isPlatformAdmin } from "../auth/context";
import { siteUrl } from "../env";
import { fail, formToObject, success, zodFail, type ActionState } from "../validation/common";
import { tenantSchema } from "../validation/store";
import { flash } from "./helpers";

/**
 * Painel master: cria loja + configurações padrão + vínculo "owner".
 * Usa service_role, mas SOMENTE depois de confirmar is_platform_admin() no banco
 * (a lista vive em platform_admins, que nenhum usuário consegue escrever pela API).
 */
export async function createTenant(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return fail("Acesso restrito à administração da plataforma.");
  const parsed = tenantSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const { name, slug, ownerEmail } = parsed.data;
  const admin = createAdminClient();

  const { data: tenant, error } = await admin.from("tenants").insert({ name, slug }).select("id").single();
  if (error) return fail(error.code === "23505" ? "Este identificador já está em uso." : "Não foi possível criar a loja.");

  const rollback = async (msg: string) => { await admin.from("tenants").delete().eq("id", tenant.id); return fail(msg); };

  const { error: sErr } = await admin.from("store_settings").insert({ tenant_id: tenant.id, store_name: name, published: false });
  if (sErr) return rollback("Não foi possível criar as configurações da loja.");

  // procura o lojista por e-mail; se não existir, envia convite pelo Supabase Auth
  const email = ownerEmail.toLowerCase();
  let { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  let invited = false;
  if (!profile) {
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/auth/redefinir` });
    if (invErr) return rollback("Não foi possível convidar o lojista. Crie o usuário em Authentication → Users e tente de novo.");
    invited = true;
    ({ data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle());
  }
  if (!profile) return rollback("Usuário do lojista não encontrado após o convite.");

  const { error: mErr } = await admin.from("memberships").insert({ tenant_id: tenant.id, user_id: profile.id, role: "owner" });
  if (mErr) return rollback("Não foi possível vincular o lojista à loja.");

  revalidatePath("/master");
  return success(
    invited
      ? `Loja criada. Convite enviado para ${email} (ele define a senha pelo link).`
      : `Loja criada e vinculada a ${email}.`,
    { slug },
  );
}

export async function setTenantStatus(fd: FormData) {
  if (!(await isPlatformAdmin())) flash("/master", "erro", "Acesso restrito.");
  const status = fd.get("status") === "suspended" ? "suspended" : "active";
  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ status }).eq("id", String(fd.get("id")));
  if (error) flash("/master", "erro", "Não foi possível alterar o status.");
  revalidatePath("/master");
  flash("/master", "ok", status === "active" ? "Loja reativada." : "Loja suspensa. A vitrine e o painel dela ficam indisponíveis.");
}
