"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { NavDepartment } from "@/lib/nav";
import { IconChevron, IconClose, IconMenu } from "./icons";
import { SearchBox } from "./SearchBox";

export function MobileMenu({ departments, trending, accountHref, accountLabel }: { departments: NavDepartment[]; trending: { name: string; slug: string }[]; accountHref: string; accountLabel: string }) {
  const pathname = usePathname();
  // o menu só vale para a página em que foi aberto: ao navegar ele fecha sozinho (sem efeito/estado extra)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const row = "flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-semibold uppercase hover:bg-steel";
  const layer = open && (
    <div className="md:hidden">
      <div className="fixed inset-0 z-[1000] bg-black/70" onClick={close} aria-hidden />
      <aside id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed bottom-0 left-0 top-0 z-[1001] flex h-dvh max-h-dvh w-[min(20rem,88vw)] flex-col overflow-hidden bg-graphite pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-steel p-3">
          <Link href="/" onClick={close} className="h-display inline-flex min-h-11 items-center text-lg">Menu</Link>
          <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Fechar menu" onClick={close}><IconClose /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="border-b border-steel p-3"><SearchBox id="search-m" trending={trending} onNavigate={close} /></div>
          <nav aria-label="Menu principal">
            <Link href="/produtos?novo=1" onClick={close} className={row}>Lançamentos</Link>
            {departments.map((d) => (
              <div key={d.key}>
                <button type="button" className={row} aria-expanded={dept === d.key} onClick={() => setDept(dept === d.key ? null : d.key)}>{d.label}<span className={dept === d.key ? "rotate-180" : ""}><IconChevron /></span></button>
                {dept === d.key && (
                  <ul className="bg-ink py-1">
                    {d.categories.map((c) => (<li key={c.id}><Link href={`/produtos?categoria=${c.slug}`} onClick={close} className="flex min-h-11 items-center justify-between px-8 text-sm hover:text-accent">{c.name}<span className="text-xs text-mute">{c.count}</span></Link></li>))}
                  </ul>
                )}
              </div>
            ))}
            <Link href="/produtos" onClick={close} className={row}>Todos os produtos</Link>
            <Link href="/produtos?promo=1" onClick={close} className={`${row} !text-accent`}>Ofertas</Link>
          </nav>
          <div className="border-t border-steel">
            <Link href={accountHref} onClick={close} className={row}>{accountLabel}</Link>
            <Link href="/favoritos" onClick={close} className={row}>Favoritos</Link>
            <Link href="/carrinho" onClick={close} className={row}>Sacola</Link>
          </div>
        </div>
      </aside>
    </div>
  );
  return (
    <>
      <button type="button" className="grid h-11 w-11 place-items-center md:hidden" aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}><IconMenu /></button>
      {/* camada independente no <body>: o cabeçalho tem backdrop-blur, que prenderia um elemento fixed dentro dele (era o corte do menu) */}
      {mounted && layer ? createPortal(layer, document.body) : null}
    </>
  );
}
