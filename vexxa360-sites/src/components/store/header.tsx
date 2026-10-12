"use client";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Search, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart";

export function StoreHeader({ slug, name, logoUrl, categories, instagram }: {
  slug: string; name: string; logoUrl: string | null; categories: { id: string; name: string }[]; instagram?: string | null;
}) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const base = `/loja/${slug}`;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button className="rounded-full p-2 hover:bg-soft lg:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href={base} className="flex items-center gap-2 font-serif text-xl tracking-tight">
          {logoUrl ? <Image src={logoUrl} alt={name} width={140} height={40} className="h-9 w-auto object-contain" priority /> : name}
        </Link>
        <nav aria-label="Categorias" className="ml-6 hidden items-center gap-5 text-sm lg:flex">
          <Link href={`${base}/produtos`} className="hover:text-accent">Todos</Link>
          {categories.slice(0, 6).map((c) => (
            <Link key={c.id} href={`${base}/produtos?categoria=${c.id}`} className="hover:text-accent">{c.name}</Link>
          ))}
          <Link href={`${base}/produtos?promocao=1`} className="font-medium text-accent">Ofertas</Link>
        </nav>
        <form action={`${base}/produtos`} className="ml-auto hidden max-w-xs flex-1 sm:block" role="search">
          <label className="sr-only" htmlFor="busca">Buscar produtos</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="busca" name="q" type="search" placeholder="Buscar produtos" className="w-full rounded-full border border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-ink focus:outline-none" />
          </div>
        </form>
        <Link href={`${base}/sacola`} className="relative ml-auto rounded-full p-2 hover:bg-soft sm:ml-0" aria-label={`Sacola, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingBag className="size-5" />
          {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-on-brand">{count}</span>}
        </Link>
      </div>
      {open && (
        <div className="border-t border-line bg-paper px-4 pb-4 lg:hidden">
          <form action={`${base}/produtos`} className="my-3" role="search">
            <input name="q" type="search" aria-label="Buscar produtos" placeholder="Buscar produtos" className="field rounded-full" />
          </form>
          <ul className="grid gap-1 text-sm" onClick={() => setOpen(false)}>
            <li><Link className="block rounded-lg px-2 py-2.5 hover:bg-soft" href={`${base}/produtos`}>Todos os produtos</Link></li>
            {categories.map((c) => <li key={c.id}><Link className="block rounded-lg px-2 py-2.5 hover:bg-soft" href={`${base}/produtos?categoria=${c.id}`}>{c.name}</Link></li>)}
            <li><Link className="block rounded-lg px-2 py-2.5 font-medium text-accent hover:bg-soft" href={`${base}/produtos?promocao=1`}>Ofertas</Link></li>
          </ul>
        </div>
      )}
    </header>
  );
}
