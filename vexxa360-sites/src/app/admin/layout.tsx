import type { Metadata } from "next";
import { requireTenant, isPlatformAdmin } from "@/lib/auth/context";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenant();
  const master = await isPlatformAdmin();
  return (
    <AdminShell
      storeName={ctx.settings?.store_name ?? ctx.tenant.name}
      storeSlug={ctx.tenant.slug}
      email={ctx.email}
      role={ctx.role}
      isMaster={master}
      tenants={ctx.memberships.map((m) => ({ id: m.tenant.id, name: m.tenant.name }))}
      activeTenantId={ctx.tenantId}
    >
      {children}
    </AdminShell>
  );
}
