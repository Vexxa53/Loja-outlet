import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getFilterOptions, getStore, listProducts, PAGE_SIZE } from "@/lib/data/store";
import { Filters, type FilterValues } from "@/components/store/filters";
import { ProductGrid } from "@/components/store/product-card";
import { EmptyState, Pagination } from "@/components/ui";
import { parseMoney } from "@/lib/money";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Produtos", alternates: { canonical: `/loja/${slug}/produtos` } };
}

export default async function Catalog({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStore(slug);
  if (!store) notFound();
  const tenantId = store.tenant.id;

  const values: FilterValues = {
    q: one(sp.q)?.slice(0, 80), categoria: one(sp.categoria), tamanho: one(sp.tamanho)?.slice(0, 20), cor: one(sp.cor)?.slice(0, 40),
    min: one(sp.min), max: one(sp.max), disponivel: one(sp.disponivel), promocao: one(sp.promocao), ordem: one(sp.ordem),
  };
  const min = values.min ? parseMoney(values.min) : NaN;
  const max = values.max ? parseMoney(values.max) : NaN;
  const sort = values.ordem === "menor-preco" || values.ordem === "maior-preco" ? values.ordem : "novidades";
  const page = Math.max(1, Math.min(500, Number(one(sp.pagina)) || 1));

  const [categories, options, result] = await Promise.all([
    getCategories(tenantId),
    getFilterOptions(tenantId),
    listProducts(tenantId, {
      q: values.q, category: values.categoria && uuidRe.test(values.categoria) ? values.categoria : undefined,
      size: values.tamanho, color: values.cor, min: Number.isNaN(min) ? undefined : min, max: Number.isNaN(max) ? undefined : max,
      inStock: values.disponivel === "1", onSale: values.promocao === "1", sort, page,
    }),
  ]);

  const params2 = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) params2.set(k, v);
  const hrefFor = (p: number) => { const u = new URLSearchParams(params2); if (p > 1) u.set("pagina", String(p)); return `/loja/${slug}/produtos${u.size ? `?${u}` : ""}`; };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl sm:text-4xl">{values.promocao === "1" ? "Ofertas" : "Produtos"}</h1>
      <p className="mt-1 text-sm text-muted">{result.total} {result.total === 1 ? "produto" : "produtos"}{result.total > PAGE_SIZE ? ` · página ${result.page} de ${result.pages}` : ""}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <Filters slug={slug} values={values} categories={categories} sizes={options.sizes} colors={options.colors} />
        <div>
          {result.items.length ? (
            <>
              <ProductGrid slug={slug} items={result.items} />
              <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
            </>
          ) : (
            <EmptyState title="Nenhum produto encontrado">Tente remover alguns filtros ou buscar por outro termo.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
