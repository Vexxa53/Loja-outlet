import Link from "next/link";
import { brl } from "@/lib/money";
import { discountPercent, effectivePrice } from "@/lib/pricing";
import { sortSizes } from "@/lib/nav";
import type { CardProduct } from "@/lib/catalog";
import { FavoriteButton } from "@/components/store/FavoriteButton";

export function ProductCard({ p, className = "", priority = false }: { p: CardProduct; className?: string; priority?: boolean }) {
  const img = p.images[0]?.url;
  const pct = discountPercent(p);
  const unavailable = p.status === "UNAVAILABLE";
  const soldOut = unavailable || p.variants.every((v) => v.stock <= 0);
  const sizes = sortSizes([...new Set(p.variants.filter((v) => v.stock > 0).map((v) => v.size))]);
  return (
    <div className={`group relative card overflow-hidden ${className}`}>
      <Link href={`/produto/${p.slug}`} className="block" aria-label={`${p.name}, ${brl(effectivePrice(p))}`}>
        <div className="relative aspect-[3/4] overflow-hidden bg-steel">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={p.images[0]?.alt || p.name} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (<div className="grid h-full place-items-center text-sm text-mute">Sem imagem</div>)}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {pct > 0 && <span className="badge badge-accent">-{pct}%</span>}
            {p.isNew && <span className="badge">Novo</span>}
            {soldOut && <span className="badge">{unavailable ? "Indisponível" : "Esgotado"}</span>}
          </div>
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-xs uppercase text-mute">{p.brand || p.category?.name}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">{p.name}</h3>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-extrabold text-accent">{brl(effectivePrice(p))}</span>
            {pct > 0 && <span className="text-sm text-mute line-through">{brl(p.priceCents)}</span>}
          </p>
          {sizes.length > 0 && <p className="truncate text-xs text-mute">Tam.: {sizes.slice(0, 7).join(" · ")}</p>}
        </div>
      </Link>
      <FavoriteButton productId={p.id} name={p.name} className="absolute right-1.5 top-1.5" />
    </div>
  );
}

/** Prateleira: rolagem horizontal com "snap" no celular e grade no computador. */
export function Shelf({ title, href, items, id }: { title: string; href?: string; items: CardProduct[]; id?: string }) {
  if (!items.length) return null;
  return (
    <section className="container-x py-8 md:py-10" aria-labelledby={id}>
      <div className="mb-4 flex items-end justify-between border-b-4 border-accent pb-2">
        <h2 id={id} className="h-display text-2xl md:text-3xl">{title}</h2>
        {href && <Link href={href} className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">Ver tudo →</Link>}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 md:pb-0 md:[&>*:nth-child(n+9)]:hidden lg:grid-cols-5 lg:[&>*:nth-child(n+9)]:block">
        {items.map((p) => <ProductCard key={p.id} p={p} className="w-[46%] shrink-0 snap-start sm:w-[32%] md:w-auto" />)}
      </div>
    </section>
  );
}
