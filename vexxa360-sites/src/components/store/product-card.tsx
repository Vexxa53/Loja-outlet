import Link from "next/link";
import Image from "next/image";
import { mediaUrl } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import type { CatalogProduct } from "@/types/db";

export function Price({ regular, effective, size = "md" }: { regular: number; effective: number; size?: "md" | "lg" }) {
  const onSale = effective < regular;
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 ${size === "lg" ? "text-2xl" : "text-sm"}`}>
      {onSale && <span className={`text-muted line-through ${size === "lg" ? "text-base" : "text-xs"}`}>{formatBRL(regular)}</span>}
      <span className={`font-semibold ${onSale ? "text-accent" : ""}`}>{formatBRL(effective)}</span>
    </div>
  );
}

export function ProductCard({ slug, p, priority = false }: { slug: string; p: CatalogProduct; priority?: boolean }) {
  const img = mediaUrl(p.image_path);
  return (
    <Link href={`/loja/${slug}/produto/${p.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-soft">
        {img ? (
          <Image src={img} alt={p.name} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" priority={priority}
            className={`object-cover transition duration-500 group-hover:scale-[1.03] ${p.in_stock ? "" : "opacity-60"}`} />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">Sem foto</div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {p.on_sale && p.discount_percent > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">-{p.discount_percent}%</span>}
          {!p.in_stock && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">Esgotado</span>}
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-2 text-sm text-ink group-hover:underline">{p.name}</h3>
        <Price regular={Number(p.regular_price)} effective={Number(p.effective_price)} />
      </div>
    </Link>
  );
}

export function ProductGrid({ slug, items }: { slug: string; items: CatalogProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => <ProductCard key={p.id} slug={slug} p={p} priority={i < 4} />)}
    </div>
  );
}
