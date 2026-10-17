import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminLogout } from "@/app/actions/admin-auth";
import { ADMIN_NAV as NAV } from "@/lib/admin-nav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdmin();
  const perms = u.role.permissions;
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-steel bg-graphite md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4"><span className="h-display text-lg">Admin<span className="text-accent">.</span></span></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0" aria-label="Admin">
          {NAV.filter(([, , p]) => !p || perms.includes(p)).map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap px-3 py-2 text-sm font-semibold hover:bg-steel hover:text-accent">{label}</Link>
          ))}
          <Link href="/" target="_blank" className="whitespace-nowrap px-3 py-2 text-sm text-mute">Ver loja ↗</Link>
        </nav>
        <form action={adminLogout} className="hidden p-3 md:block"><p className="mb-1 text-xs text-mute">{u.name} · {u.role.label}</p><button className="btn btn-ghost w-full !py-1.5">Sair</button></form>
      </aside>
      <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
