import Link from "next/link";
import type { Metadata } from "next";
import { facets, searchCatalog, type CatalogQuery } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = { title: "Produtos" };

export default async function Catalog({ searchParams }: { searchParams: Promise<CatalogQuery> }) {
  const sp = await searchParams;
  const [{ products, total, page, pages }, f] = await Promise.all([searchCatalog(sp), facets()]);
  const link = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `/produtos?${u}`;
  };
  return (
    <div className="container-x py-8 grid gap-8 md:grid-cols-[240px_1fr]">
      <form className="space-y-4 text-sm" method="get">
        <div><label className="label" htmlFor="q">Busca</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
        <div><label className="label" htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={sp.categoria ?? ""} className="input"><option value="">Todas</option>{f.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="min">Preço mín.</label><input id="min" name="min" inputMode="decimal" defaultValue={sp.min} className="input" /></div>
          <div><label className="label" htmlFor="max">Preço máx.</label><input id="max" name="max" inputMode="decimal" defaultValue={sp.max} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="tamanho">Tamanho</label>
          <select id="tamanho" name="tamanho" defaultValue={sp.tamanho ?? ""} className="input"><option value="">Todos</option>{f.sizes.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="cor">Cor</label>
          <select id="cor" name="cor" defaultValue={sp.cor ?? ""} className="input"><option value="">Todas</option>{f.colors.map((s) => <option key={s}>{s}</option>)}</select></div>
        <label className="flex items-center gap-2"><input type="checkbox" name="disponivel" value="1" defaultChecked={sp.disponivel === "1"} /> Apenas disponíveis</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="promo" value="1" defaultChecked={sp.promo === "1"} /> Apenas promoções</label>
        <div><label className="label" htmlFor="ordem">Ordenar por</label>
          <select id="ordem" name="ordem" defaultValue={sp.ordem ?? ""} className="input">
            <option value="">Relevância</option><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option><option value="vendidos">Mais vendidos</option></select></div>
        <button className="btn w-full">Filtrar</button>
        <Link href="/produtos" className="block text-center text-mute underline">Limpar filtros</Link>
      </form>
      <section>
        <p className="mb-4 text-sm text-mute">{total} produto(s) encontrado(s)</p>
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 md:gap-5">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (<p className="card p-8 text-center text-mute">Nenhum produto encontrado.</p>)}
        {pages > 1 && (
          <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Paginação">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={link(n)} className={`btn ${n === page ? "" : "btn-ghost"}`}>{n}</Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}
