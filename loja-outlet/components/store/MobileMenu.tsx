"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavDepartment } from "@/lib/nav";
import { IconChevron, IconClose, IconMenu } from "./icons";
import { SearchBox } from "./SearchBox";

export function MobileMenu({ departments, trending, accountHref, accountLabel }: { departments: NavDepartment[]; trending: { name: string; slug: string }[]; accountHref: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);
  const row = "flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-semibold uppercase hover:bg-steel";
  return (
    <>
      <button type="button" className="grid h-11 w-11 place-items-center md:hidden" aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}><IconMenu /></button>
      {open && <div className="fixed inset-0 z-[60] bg-black/70 md:hidden" onClick={close} aria-hidden />}
      <aside id="mobile-menu" aria-hidden={!open} className={`fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[88vw] flex-col overflow-y-auto bg-graphite transition-transform md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-steel p-3">
          <span className="h-display text-lg">Menu</span>
          <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Fechar menu" onClick={close}><IconClose /></button>
        </div>
        <div className="border-b border-steel p-3">{open && <SearchBox id="search-m" trending={trending} onNavigate={close} />}</div>
        <nav aria-label="Menu principal" className="flex-1">
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
        </div>
      </aside>
    </>
  );
}
