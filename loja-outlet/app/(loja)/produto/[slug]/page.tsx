import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { brl } from "@/lib/money";
import { discountPercent, effectivePrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { listFor } from "@/lib/catalog";
import { Shelf } from "@/components/ProductCard";
import { Gallery } from "@/components/store/Gallery";
import { ShippingCalc } from "@/components/store/ShippingCalc";
import { FavoriteButton } from "@/components/store/FavoriteButton";
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
  const [s, related] = await Promise.all([getSettings(), listFor({ categoryId: p.categoryId ?? undefined, id: { not: p.id } }, 10)]);
  const pct = discountPercent(p);
  const unavailable = p.status === "UNAVAILABLE";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, description: p.description,
    image: p.images.map((i) => i.url),
    offers: { "@type": "Offer", priceCurrency: "BRL", price: (effectivePrice(p) / 100).toFixed(2),
      availability: !unavailable && p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x pt-5">
        <nav aria-label="Você está em" className="text-xs text-mute">
          <Link className="inline-flex min-h-11 items-center hover:text-accent" href="/">Início</Link> <span aria-hidden>›</span>{" "}
          {p.category && <><Link className="inline-flex min-h-11 items-center hover:text-accent" href={`/produtos?categoria=${p.category.slug}`}>{p.category.name}</Link> <span aria-hidden>›</span>{" "}</>}
          <span className="text-white">{p.name}</span>
        </nav>
      </div>
      <div className="container-x grid gap-8 py-5 md:grid-cols-[1.1fr_1fr] md:py-8">
        <Gallery images={p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))} name={p.name} />
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase text-mute">{p.brand || p.category?.name} · Cód. {p.sku}</p>
            <div className="mt-1 flex items-start justify-between gap-3"><h1 className="h-display text-2xl md:text-4xl">{p.name}</h1><FavoriteButton productId={p.id} name={p.name} className="shrink-0 !bg-steel" /></div>
          </div>
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-accent">{brl(effectivePrice(p))}</span>
            {pct > 0 && (<><span className="text-mute line-through">{brl(p.priceCents)}</span><span className="badge badge-accent">-{pct}%</span></>)}
          </p>
          {unavailable
            ? <p className="flash">Este produto está indisponível no momento.</p>
            : <AddToCart variants={p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.stock }))} />}
          <ShippingCalc productId={p.id} />
          <ul className="space-y-1 border-t border-steel pt-4 text-sm text-zinc-300">
            <li>✓ Frete grátis acima de {brl(s.shipping.freeAboveCents)}</li>
            <li>✓ Troca e devolução conforme a <Link className="underline" href="/politicas/trocas">política da loja</Link></li>
            <li>✓ Compra segura, com seus dados protegidos</li>
          </ul>
          <details open className="border-t border-steel pt-3"><summary className="flex min-h-11 cursor-pointer items-center font-bold uppercase">Descrição</summary>
            <div className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{p.description || "Sem descrição."}</div></details>
        </div>
      </div>
      <Shelf id="sh-rel" title="Você também pode gostar" items={related} />
    </>
  );
}
