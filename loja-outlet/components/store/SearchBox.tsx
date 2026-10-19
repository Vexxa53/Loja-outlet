"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brl } from "@/lib/money";
import { IconSearch } from "./icons";

type Result = { products: { name: string; slug: string; priceCents: number; oldCents: number | null; image: string | null }[]; categories: { name: string; slug: string }[] };
const EMPTY: Result = { products: [], categories: [] };

export function SearchBox({ trending, id = "search", autoFocus = false, onNavigate }: { trending: { name: string; slug: string }[]; id?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<Result>(EMPTY);
  const [loading, setLoading] = useState(false);
  const term = q.trim();

  // sugestões ao digitar (com atraso para não consultar a cada tecla)
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setRes(r.ok ? await r.json() : EMPTY);
      } catch { /* cancelado */ } finally { setLoading(false); }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const go = (href: string) => { setOpen(false); onNavigate?.(); router.push(href); };
  const showing = term.length >= 2 ? res : EMPTY;

  return (
    <div ref={box} className="relative w-full">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (term) go(`/produtos?q=${encodeURIComponent(term)}`); }} className="relative">
        <label htmlFor={id} className="sr-only">Buscar produtos</label>
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          autoFocus={autoFocus} autoComplete="off" placeholder="Buscar camisas, tênis, relógios..." className="input !pr-12" role="combobox" aria-expanded={open} aria-controls={`${id}-panel`} />
        <button className="absolute right-0 top-0 grid h-11 w-11 place-items-center hover:text-accent" aria-label="Buscar"><IconSearch /></button>
      </form>
      {open && (
        <div id={`${id}-panel`} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto border border-line bg-graphite shadow-2xl">
          {term.length < 2 ? (
            <div className="p-4">
              <p className="label">Em alta</p>
              <div className="flex flex-wrap gap-2">
                {trending.map((c) => (<button key={c.slug} type="button" onClick={() => go(`/produtos?categoria=${c.slug}`)} className="btn btn-ghost !min-h-10 !px-3 !py-1.5 normal-case">{c.name}</button>))}
                <button type="button" onClick={() => go("/produtos?promo=1")} className="btn !min-h-10 !px-3 !py-1.5 normal-case">Ofertas</button>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {loading && <p className="px-2 py-1 text-xs text-mute" role="status">Buscando...</p>}
              {showing.categories.map((c) => (<button key={c.slug} type="button" onClick={() => go(`/produtos?categoria=${c.slug}`)} className="flex min-h-11 w-full items-center px-2 text-left text-sm font-semibold hover:bg-steel">Ver categoria: <span className="ml-1 text-accent">{c.name}</span></button>))}
              {showing.products.map((p) => (
                <Link key={p.slug} href={`/produto/${p.slug}`} onClick={() => { setOpen(false); onNavigate?.(); }} className="flex items-center gap-3 px-2 py-2 hover:bg-steel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="h-14 w-11 shrink-0 object-cover" /> : <span className="h-14 w-11 shrink-0 bg-steel" />}
                  <span className="min-w-0 flex-1 text-sm"><span className="block truncate font-semibold">{p.name}</span>
                    <span className="font-bold text-accent">{brl(p.priceCents)}</span>{p.oldCents && <span className="ml-2 text-xs text-mute line-through">{brl(p.oldCents)}</span>}</span>
                </Link>
              ))}
              {!loading && !showing.products.length && !showing.categories.length && <p className="px-2 py-3 text-sm text-mute">Nada encontrado para “{term}”. Tente outro termo.</p>}
              <button type="button" onClick={() => go(`/produtos?q=${encodeURIComponent(term)}`)} className="mt-1 flex min-h-11 w-full items-center justify-center border-t border-line text-sm font-semibold text-accent hover:bg-steel">Ver todos os resultados para “{term}”</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
