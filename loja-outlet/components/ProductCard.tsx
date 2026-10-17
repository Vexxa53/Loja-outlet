import Link from "next/link";
import { brl } from "@/lib/money";
import { discountPercent, effectivePrice } from "@/lib/pricing";
import type { CardProduct } from "@/lib/catalog";

export function ProductCard({ p }: { p: CardProduct }) {
  const img = p.images[0]?.url;
  const pct = discountPercent(p);
  const soldOut = p.variants.every((v) => v.stock <= 0);
  return (
    <Link href={`/produto/${p.slug}`} className="group block card overflow-hidden">
      <div className="relative aspect-[3/4] bg-steel overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={p.images[0]?.alt || p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-mute text-sm">Sem imagem</div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {pct > 0 && <span className="badge badge-accent">-{pct}%</span>}
          {p.isNew && <span className="badge">Novo</span>}
          {soldOut && <span className="badge">Esgotado</span>}
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs text-mute uppercase">{p.category?.name}</p>
        <h3 className="font-semibold leading-tight">{p.name}</h3>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-accent">{brl(effectivePrice(p))}</span>
          {pct > 0 && <span className="text-sm text-mute line-through">{brl(p.priceCents)}</span>}
        </p>
      </div>
    </Link>
  );
}

export function Shelf({ title, href, items }: { title: string; href?: string; items: CardProduct[] }) {
  if (!items.length) return null;
  return (
    <section className="container-x py-10">
      <div className="mb-5 flex items-end justify-between border-b-4 border-accent pb-2">
        <h2 className="h-display text-2xl md:text-3xl">{title}</h2>
        {href && <Link href={href} className="text-sm text-accent hover:underline">Ver tudo →</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}
