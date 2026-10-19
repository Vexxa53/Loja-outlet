"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NavDepartment } from "@/lib/nav";
import { IconChevron } from "./icons";

const linkCls = "inline-flex min-h-11 items-center gap-1 px-3 text-sm font-semibold uppercase hover:text-accent";

/** Menu de departamentos com painel (abre ao passar o mouse, ao focar ou ao clicar; Esc fecha). */
export function MegaNav({ departments }: { departments: NavDepartment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", away);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); };
  }, []);

  const enter = (k: string) => { clearTimeout(timer.current); setOpen(k); };
  const leave = () => { timer.current = setTimeout(() => setOpen(null), 120); };
  const current = departments.find((d) => d.key === open);

  return (
    <nav ref={root} aria-label="Departamentos" className="relative hidden border-t border-steel md:block" onMouseLeave={leave} onMouseEnter={() => clearTimeout(timer.current)}>
      <div className="container-x flex flex-wrap items-center">
        <Link href="/produtos?novo=1" className={linkCls} onMouseEnter={() => setOpen(null)}>Lançamentos</Link>
        {departments.map((d) => (
          <button key={d.key} type="button" className={linkCls} aria-expanded={open === d.key} aria-haspopup="true"
            onMouseEnter={() => enter(d.key)} onFocus={() => enter(d.key)} onClick={() => setOpen(open === d.key ? null : d.key)}>
            {d.label}<IconChevron />
          </button>
        ))}
        <Link href="/produtos" className={linkCls} onMouseEnter={() => setOpen(null)}>Todos</Link>
        <Link href="/produtos?promo=1" className={`${linkCls} !text-accent`} onMouseEnter={() => setOpen(null)}>Ofertas</Link>
      </div>
      {current && (
        <div className="absolute left-0 right-0 top-full z-50 border-y border-line bg-graphite shadow-2xl" onMouseEnter={() => clearTimeout(timer.current)}>
          <div className="container-x grid gap-6 py-5 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="label">{current.label}</p>
              <ul className="space-y-0.5">
                {current.categories.map((c) => (<li key={c.id}><Link href={`/produtos?categoria=${c.slug}`} onClick={() => setOpen(null)} className="flex min-h-11 items-center justify-between text-sm font-semibold hover:text-accent">{c.name}<span className="text-xs font-normal text-mute">{c.count}</span></Link></li>))}
              </ul>
              <Link href={`/produtos?${current.categories.map((c) => `categoria=${c.slug}`).slice(0, 1).join("")}`} onClick={() => setOpen(null)} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent underline">Ver tudo em {current.label}</Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {current.categories.slice(0, 3).map((c) => (
                <Link key={c.id} href={`/produtos?categoria=${c.slug}`} onClick={() => setOpen(null)} className="group relative block aspect-[4/3] overflow-hidden bg-steel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.image && <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 text-sm font-bold uppercase">{c.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
