"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminNav({ items, userLabel, logout }: { items: { href: string; label: string }[]; userLabel: string; logout: () => Promise<void> }) {
  const path = usePathname();
  // a gaveta fecha sozinha ao trocar de página (o estado "aberta" é atrelado ao caminho atual)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const links = (
    <nav className="flex flex-col" aria-label="Menu do painel">
      {items.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center px-4 text-sm font-semibold hover:bg-steel hover:text-accent ${active ? "border-l-4 border-accent bg-steel text-accent" : "border-l-4 border-transparent"}`}>{it.label}</Link>
        );
      })}
      <Link href="/" target="_blank" className="flex min-h-11 items-center px-4 text-sm text-mute">Ver loja ↗</Link>
    </nav>
  );
  const foot = (
    <form action={logout} className="p-3"><p className="mb-2 text-xs text-mute">{userLabel}</p><button className="btn btn-ghost w-full">Sair</button></form>
  );

  return (
    <>
      {/* celular/tablet: barra superior + gaveta */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-steel bg-graphite px-3 py-2 md:hidden">
        <span className="h-display text-lg">Admin<span className="text-accent">.</span></span>
        <button type="button" className="btn btn-ghost" aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(true)}>☰ Menu</button>
      </div>
      {open && <div className="fixed inset-0 z-50 bg-black/70 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside id="admin-drawer" className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-steel bg-graphite transition-transform md:static md:z-auto md:w-56 md:max-w-none md:translate-x-0 md:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between p-4"><span className="h-display text-lg">Admin<span className="text-accent">.</span></span>
          <button type="button" className="btn btn-ghost md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">✕</button></div>
        <div className="flex-1">{links}</div>
        {foot}
      </aside>
    </>
  );
}
