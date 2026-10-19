import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminLogout } from "@/app/actions/admin-auth";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdmin();
  const perms = u.role.permissions;
  const items = ADMIN_NAV.filter(([, , p]) => !p || perms.includes(p)).map(([href, label]) => ({ href, label }));
  return (
    <div className="min-h-screen md:flex">
      <AdminNav items={items} userLabel={`${u.name} · ${u.role.label}`} logout={adminLogout} />
      <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
