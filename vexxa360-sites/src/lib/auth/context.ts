import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import type { Role, StoreSettings, Tenant } from "@/types/db";

export const TENANT_COOKIE = "vx_tenant";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // valida o JWT no Supabase Auth
  return data.user;
});

export type Membership = { role: Role; tenant: Tenant };

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, tenants(id, name, slug, status)")
    .eq("user_id", user.id);
  return (data ?? [])
    .map((m: any) => ({ role: m.role as Role, tenant: m.tenants as Tenant }))
    .filter((m) => m.tenant && m.tenant.status === "active");
});

export type TenantContext = {
  userId: string;
  email: string | undefined;
  tenantId: string;
  tenant: Tenant;
  role: Role;
  memberships: Membership[];
  settings: StoreSettings | null;
};

/**
 * Contexto autorizado do painel. O tenant ativo vem de um cookie, mas SEMPRE é
 * revalidado contra as memberships reais do usuário (o cookie sozinho não dá acesso a nada).
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;
  const wanted = (await cookies()).get(TENANT_COOKIE)?.value;
  const active = memberships.find((m) => m.tenant.id === wanted) ?? memberships[0];
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("store_settings")
    .select("*")
    .eq("tenant_id", active.tenant.id)
    .maybeSingle();
  return {
    userId: user.id,
    email: user.email,
    tenantId: active.tenant.id,
    tenant: active.tenant,
    role: active.role,
    memberships,
    settings: settings as StoreSettings | null,
  };
});

/** Para páginas/ações do painel. Redireciona se não houver sessão ou vínculo com loja. */
export async function requireTenant(allowed: Role[] = ["owner", "admin", "staff"]): Promise<TenantContext> {
  const user = await getUser();
  if (!user) redirect("/login");
  const ctx = await getTenantContext();
  if (!ctx) redirect("/sem-loja");
  if (!allowed.includes(ctx.role)) redirect("/admin?erro=permissao");
  return ctx;
}

/** Variante para Server Actions: não redireciona, devolve null quando não autorizado. */
export async function authorize(allowed: Role[] = ["owner", "admin", "staff"]): Promise<TenantContext | null> {
  const ctx = await getTenantContext();
  if (!ctx || !allowed.includes(ctx.role)) return null;
  return ctx;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

export async function requirePlatformAdmin() {
  const user = await getUser();
  if (!user) redirect("/login?next=/master");
  if (!(await isPlatformAdmin())) redirect("/admin");
  return user;
}

export { safeNext } from "../safe-next";
