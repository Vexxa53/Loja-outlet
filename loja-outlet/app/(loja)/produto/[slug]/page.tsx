import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { brl } from "@/lib/money";
import { discountPercent, effectivePrice } from "@/lib/pricing";
import { listFor } from "@/lib/catalog";
import { Shelf } from "@/components/ProductCard";
import { AddToCart } from "./AddToCart";

async function load(slug: string) {
  return db.product.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "UNAVAILABLE"] } },
    include: { images: { orderBy: { position: "asc" } }, variants: { where: { active: true }, orderBy: [{ size: "asc" }] }, category: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  return {
    title: p.seoTitle || p.name,
    description: p.seoDescription || p.description.slice(0, 160),
    openGraph: { images: p.images[0] ? [p.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const pct = discountPercent(p);
  const related = await listFor({ categoryId: p.categoryId ?? undefined, id: { not: p.id } }, 4);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, description: p.description,
    image: p.images.map((i) => i.url),
    offers: { "@type": "Offer", priceCurrency: "BRL", price: (effectivePrice(p) / 100).toFixed(2),
      availability: p.status === "PUBLISHED" && p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x grid gap-8 py-8 md:grid-cols-2">
        <div className="space-y-3">
          {p.images.length ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0].url} alt={p.images[0].alt || p.name} className="w-full card" fetchPriority="high" decoding="async" />
              <div className="grid grid-cols-4 gap-2">
                {p.images.slice(1).map((i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i.id} src={i.url} alt={i.alt || p.name} className="card aspect-square w-full object-cover" loading="lazy" />
                ))}
              </div>
            </>
          ) : <div className="card grid aspect-[3/4] place-items-center text-mute">Sem imagem</div>}
        </div>
        <div>
          <p className="text-xs uppercase text-mute">{p.category?.name} · SKU {p.sku}</p>
          <h1 className="h-display mt-1 text-3xl md:text-4xl">{p.name}</h1>
          <p className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-accent">{brl(effectivePrice(p))}</span>
            {pct > 0 && (<><span className="text-mute line-through">{brl(p.priceCents)}</span><span className="badge badge-accent">-{pct}%</span></>)}
          </p>
          <div className="mt-6">
            {p.status === "UNAVAILABLE"
              ? <p className="flash">Este produto está indisponível no momento.</p>
              : <AddToCart variants={p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.stock }))} />}
          </div>
          <div className="mt-8 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{p.description}</div>
        </div>
      </div>
      <Shelf title="Produtos relacionados" items={related} />
    </>
  );
}
