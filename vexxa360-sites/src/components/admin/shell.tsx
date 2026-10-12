"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Shirt, Tags, Boxes, Percent, Image as ImageIcon, ShoppingBag, Palette, Settings,
  PanelLeftClose, PanelLeftOpen, Menu, X, ExternalLink, LogOut, Crown,
} from "lucide-react";
import { cn } from "../ui";
import { signOut, switchTenant } from "@/lib/actions/auth";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/produtos", label: "Produtos", icon: Shirt },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/estoque", label: "Estoque", icon: Boxes },
  { href: "/admin/promocoes", label: "Preços e promoções", icon: Percent },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/personalizacao", label: "Personalizar loja", icon: Palette },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

type Props = {
  storeName: string; storeSlug: string; email?: string; role: string; isMaster: boolean;
  tenants: { id: string; name: string }[]; activeTenantId: string; children: React.ReactNode;
};

export function AdminShell({ storeName, storeSlug, email, role, isMaster, tenants, activeTenantId, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Menu do painel" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition", active ? "bg-ink text-white" : "text-ink/80 hover:bg-soft")}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={cn(collapsed && "lg:hidden")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <p className="font-serif text-lg leading-tight">Vexxa360°</p>
          <p className="truncate text-xs text-muted">{storeName}</p>
        </div>
        <button className="hidden rounded-lg p-2 hover:bg-soft lg:block" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
        <button className="rounded-lg p-2 hover:bg-soft lg:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)}><X className="size-4" /></button>
      </div>
      {tenants.length > 1 && !collapsed && (
        <form action={switchTenant} className="border-b border-line px-3 py-3">
          <label className="label" htmlFor="tenant-switch">Loja</label>
          <select id="tenant-switch" name="tenantId" defaultValue={activeTenantId} className="field py-2" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </form>
      )}
      {nav}
      <div className="space-y-1 border-t border-line p-3 text-sm">
        <Link href={`/loja/${storeSlug}`} target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-soft"><ExternalLink className="size-4" /><span className={cn(collapsed && "lg:hidden")}>Ver minha loja</span></Link>
        {isMaster && <Link href="/master" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-soft"><Crown className="size-4" /><span className={cn(collapsed && "lg:hidden")}>Painel master</span></Link>}
        <form action={signOut}><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-soft"><LogOut className="size-4" /><span className={cn(collapsed && "lg:hidden")}>Sair</span></button></form>
        <p className={cn("truncate px-3 pt-2 text-xs text-muted", collapsed && "lg:hidden")} title={email}>{email} · {role === "owner" ? "Proprietário" : role === "admin" ? "Administrador" : "Equipe"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-r border-line bg-white transition-[width] lg:block", collapsed ? "w-[72px]" : "w-64")}>{sidebar}</aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
        <button className="rounded-lg p-2 hover:bg-soft" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="size-5" /></button>
        <span className="font-serif text-lg">{storeName}</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0 flex-1"><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</main></div>
    </div>
  );
}
