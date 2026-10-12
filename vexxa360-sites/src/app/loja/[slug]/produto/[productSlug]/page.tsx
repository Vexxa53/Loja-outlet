import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductPage, getRelated, getStore } from "@/lib/data/store";
import { mediaUrl, siteUrl } from "@/lib/env";
import { Gallery } from "@/components/store/gallery";
import { ProductBuy } from "@/components/store/product-buy";
import { Price, ProductGrid } from "@/components/store/product-card";

type Props = { params: Promise<{ slug: string; productSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const store = await getStore(slug);
  if (!store) return {};
  const data = await getProductPage(store.tenant.id, productSlug);
  if (!data) return { title: "Produto não encontrado", robots: { index: false } };
  const img = mediaUrl(data.images[0]?.storage_path);
  const description = (data.product.description ?? `${data.product.name} em ${store.settings.store_name}`).slice(0, 160);
  return {
    title: data.product.name,
    description,
    alternates: { canonical: `/loja/${slug}/produto/${productSlug}` },
    openGraph: { title: data.product.name, description, type: "website", images: img ? [img] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productSlug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  const data = await getProductPage(store.tenant.id, productSlug);
  if (!data) notFound();
  const { product, variants, images, price, category } = data;
  const related = await getRelated(store.tenant.id, product.id, product.category_id);
  const imgs = images.map((i) => ({ url: mediaUrl(i.storage_path)!, alt: i.alt_text ?? product.name })).filter((i) => i.url);
  const inStock = variants.some((v) => v.stock_quantity > 0);
  const sizeGuide = product.size_guide || store.settings.size_guide;

  // Dados estruturados com informações reais (sem avaliações inventadas)
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description ?? undefined, sku: product.sku ?? undefined,
    image: imgs.map((i) => i.url),
    offers: {
      "@type": "Offer", priceCurrency: "BRL", price: price.effective.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl()}/loja/${slug}/produto/${productSlug}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Você está em" className="mb-6 text-sm text-muted">
        <Link href={`/loja/${slug}`} className="hover:text-ink">Início</Link> /{" "}
        <Link href={`/loja/${slug}/produtos`} className="hover:text-ink">Produtos</Link>
        {category && <> / <Link href={`/loja/${slug}/produtos?categoria=${category.id}`} className="hover:text-ink">{category.name}</Link></>}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery images={imgs} name={product.name} />
        <div className="lg:pt-4">
          <h1 className="font-serif text-3xl sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <Price regular={Number(product.regular_price)} effective={price.effective} size="lg" />
            {price.onSale && price.percent > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">-{price.percent}%</span>}
          </div>
          {!inStock && <p className="mt-3 rounded-lg bg-soft px-3 py-2 text-sm">Produto esgotado no momento.</p>}

          <div className="mt-8">
            <ProductBuy slug={slug} productSlug={productSlug} name={product.name} image={imgs[0]?.url ?? null}
              variants={variants.map((v) => ({ id: v.id, size: v.size, color: v.color, stock_quantity: v.stock_quantity }))} />
          </div>

          {product.description && (
            <div className="mt-10"><h2 className="label">Descrição</h2><p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{product.description}</p></div>
          )}
          {(product.composition || product.care_instructions) && (
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              {product.composition && <div><dt className="label">Composição</dt><dd>{product.composition}</dd></div>}
              {product.care_instructions && <div><dt className="label">Lavagem</dt><dd>{product.care_instructions}</dd></div>}
            </dl>
          )}
          {sizeGuide && (
            <details className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
              <summary className="cursor-pointer font-medium">Guia de medidas</summary>
              <p className="mt-3 whitespace-pre-line text-muted">{sizeGuide}</p>
            </details>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="rel">
          <h2 id="rel" className="mb-6 font-serif text-2xl">Você também pode gostar</h2>
          <ProductGrid slug={slug} items={related} />
        </section>
      )}
    </div>
  );
}
