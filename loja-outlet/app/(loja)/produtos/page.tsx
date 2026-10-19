import Link from "next/link";
import type { Metadata } from "next";
import { facets, searchCatalog, type CatalogQuery } from "@/lib/catalog";
import { CATEGORY_INTRO, PRICE_BANDS, SORTS, qs } from "@/lib/catalog-url";
import { colorStyle } from "@/lib/nav";
import { ProductCard } from "@/components/ProductCard";
import { SortSelect } from "@/components/store/SortSelect";

type F = Awaited<ReturnType<typeof facets>>;
const chip = "inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-sm font-semibold";
const on = "border-accent bg-accent text-black";
const off = "border-line hover:border-accent hover:text-accent";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogQuery> }): Promise<Metadata> {
  const sp = await searchParams;
  const f = await facets({ ...sp, categoria: undefined });
  const cat = f.categories.find((c) => c.slug === sp.categoria);
  return { title: cat ? cat.name : sp.q ? `Busca: ${sp.q}` : "Todos os produtos", description: cat ? CATEGORY_INTRO[cat.slug] : undefined };
}

function Group({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-steel py-2">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-bold uppercase">{title}<span aria-hidden className="text-accent group-open:rotate-45">+</span></summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}

function Filters({ sp, f, hasFilters }: { sp: CatalogQuery; f: F; hasFilters: boolean }) {
  return (
    <div className="text-sm">
      {hasFilters && <Link href={sp.q ? `/produtos?q=${encodeURIComponent(sp.q)}` : "/produtos"} className="inline-flex min-h-11 items-center text-accent underline">Limpar filtros</Link>}
      <Group title="Categoria">
        <ul>
          <li><Link href={qs(sp, { categoria: undefined })} className={`flex min-h-11 items-center justify-between hover:text-accent ${!sp.categoria ? "font-bold text-accent" : ""}`}>Todas</Link></li>
          {f.categories.map((c) => (<li key={c.id}><Link href={qs(sp, { categoria: c.slug })} aria-current={sp.categoria === c.slug} className={`flex min-h-11 items-center justify-between hover:text-accent ${sp.categoria === c.slug ? "font-bold text-accent" : ""}`}>{c.name}<span className="text-xs font-normal text-mute">{c.count}</span></Link></li>))}
        </ul>
      </Group>
      {f.sizes.length > 0 && (
        <Group title="Tamanho"><div className="flex flex-wrap gap-2">
          {f.sizes.map((s) => (<Link key={s} href={qs(sp, { tamanho: sp.tamanho === s ? undefined : s })} aria-pressed={sp.tamanho === s} className={`${chip} ${sp.tamanho === s ? on : off}`}>{s}</Link>))}
        </div></Group>
      )}
      {f.colors.length > 0 && (
        <Group title="Cor"><div className="flex flex-wrap gap-2">
          {f.colors.map((c) => (<Link key={c} href={qs(sp, { cor: sp.cor === c ? undefined : c })} aria-pressed={sp.cor === c} title={c} className={`inline-flex min-h-11 items-center gap-2 border px-2 text-xs ${sp.cor === c ? on : off}`}>
            <span className="h-5 w-5 shrink-0 rounded-full border border-white/30" style={{ background: colorStyle(c) }} />{c}</Link>))}
        </div></Group>
      )}
      <Group title="Preço">
        <ul>{PRICE_BANDS.map((b) => { const act = sp.min === b.min && sp.max === b.max; return (<li key={b.label}><Link href={qs(sp, act ? { min: undefined, max: undefined } : { min: b.min, max: b.max })} className={`flex min-h-11 items-center hover:text-accent ${act ? "font-bold text-accent" : ""}`}>{b.label}</Link></li>); })}</ul>
        <form method="get" action="/produtos" className="mt-2 flex items-end gap-2">
          {Object.entries(sp).filter(([k, v]) => v && !["min", "max", "pagina"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="min-w-0 flex-1"><span className="label">Mín. (R$)</span><input name="min" inputMode="decimal" defaultValue={sp.min} className="input" /></label>
          <label className="min-w-0 flex-1"><span className="label">Máx. (R$)</span><input name="max" inputMode="decimal" defaultValue={sp.max} className="input" /></label>
          <button className="btn btn-ghost" aria-label="Aplicar faixa de preço">OK</button>
        </form>
      </Group>
      <Group title="Mais opções">
        <ul>
          {([["disponivel", "Somente disponíveis"], ["promo", "Em promoção"], ["novo", "Lançamentos"]] as const).map(([k, l]) => (
            <li key={k}><Link href={qs(sp, { [k]: sp[k] === "1" ? undefined : "1" })} aria-pressed={sp[k] === "1"} className="flex min-h-11 items-center gap-2 hover:text-accent">
              <span className={`grid h-5 w-5 place-items-center border ${sp[k] === "1" ? on : "border-line"}`} aria-hidden>{sp[k] === "1" ? "✓" : ""}</span>{l}</Link></li>
          ))}
        </ul>
      </Group>
    </div>
  );
}

function pageList(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

export default async function Catalog({ searchParams }: { searchParams: Promise<CatalogQuery> }) {
  const sp = await searchParams;
  const [{ products, total, page, pages }, f] = await Promise.all([searchCatalog(sp), facets(sp)]);
  const cat = f.categories.find((c) => c.slug === sp.categoria);
  const cols = ["2", "3", "4"].includes(sp.col ?? "") ? sp.col! : "3";
  const gridCls = cols === "2" ? "lg:grid-cols-2" : cols === "4" ? "lg:grid-cols-4" : "lg:grid-cols-3";
  const title = cat ? cat.name : sp.q ? `Resultados para “${sp.q}”` : sp.novo ? "Lançamentos" : sp.promo ? "Ofertas" : "Todos os produtos";
  const sizeLabel = sp.tamanho ? `Tamanho ${sp.tamanho}` : null;
  const active: [string, string][] = [
    ...(cat ? [[`Categoria: ${cat.name}`, qs(sp, { categoria: undefined })] as [string, string]] : []),
    ...(sizeLabel ? [[sizeLabel, qs(sp, { tamanho: undefined })] as [string, string]] : []),
    ...(sp.cor ? [[`Cor: ${sp.cor}`, qs(sp, { cor: undefined })] as [string, string]] : []),
    ...(sp.min || sp.max ? [[`Preço: ${sp.min ? `de R$ ${sp.min}` : ""} ${sp.max ? `até R$ ${sp.max}` : ""}`.trim(), qs(sp, { min: undefined, max: undefined })] as [string, string]] : []),
    ...(sp.disponivel === "1" ? [["Somente disponíveis", qs(sp, { disponivel: undefined })] as [string, string]] : []),
    ...(sp.promo === "1" ? [["Em promoção", qs(sp, { promo: undefined })] as [string, string]] : []),
    ...(sp.novo === "1" ? [["Lançamentos", qs(sp, { novo: undefined })] as [string, string]] : []),
  ];
  const hasFilters = active.length > 0;
  const base = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "ordem" && k !== "pagina")) as Record<string, string>;
  const jsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Início", item: "/" }, { "@type": "ListItem", position: 2, name: title }] };

  return (
    <div className="container-x py-6 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Você está em" className="mb-3 text-xs text-mute"><Link className="hover:text-accent" href="/">Início</Link> <span aria-hidden>›</span> <Link className="hover:text-accent" href="/produtos">Produtos</Link>{cat && <> <span aria-hidden>›</span> <span className="text-white">{cat.name}</span></>}</nav>
      <h1 className="h-display text-3xl md:text-4xl">{title}</h1>
      {cat && CATEGORY_INTRO[cat.slug] && <p className="mt-2 max-w-3xl text-sm text-zinc-300">{CATEGORY_INTRO[cat.slug]}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-steel py-2">
        <p className="text-sm text-mute" role="status">{total} produto(s) encontrado(s)</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-1 lg:flex" aria-label="Colunas da grade">
            {["2", "3", "4"].map((c) => <Link key={c} href={qs(sp, { col: c, pagina: sp.pagina })} aria-pressed={cols === c} aria-label={`${c} colunas`} className={`${chip} !min-w-11 !px-0 ${cols === c ? on : off}`}>{c}</Link>)}
          </div>
          <SortSelect base={base} current={sp.ordem ?? ""} options={SORTS} />
        </div>
      </div>
      {hasFilters && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Filtros ativos">
          {active.map(([label, href]) => (<li key={label}><Link href={href} className="inline-flex min-h-11 items-center gap-2 border border-accent px-3 text-xs font-semibold hover:bg-steel" aria-label={`Remover filtro ${label}`}>{label} <span aria-hidden>✕</span></Link></li>))}
        </ul>
      )}

      <div className="mt-5 grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside aria-label="Filtros">
          <details className="card lg:hidden"><summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 font-semibold uppercase">Filtros {hasFilters && <span className="badge badge-accent">{active.length}</span>}</summary><div className="border-t border-steel px-4 pb-2"><Filters sp={sp} f={f} hasFilters={hasFilters} /></div></details>
          <div className="hidden lg:block"><Filters sp={sp} f={f} hasFilters={hasFilters} /></div>
        </aside>
        <section aria-label="Produtos">
          {products.length ? (
            <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 ${gridCls}`}>{products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
          ) : (
            <div className="card space-y-3 p-8 text-center"><p className="text-lg font-semibold">Nenhum produto encontrado</p><p className="text-sm text-mute">Tente remover algum filtro ou buscar por outro termo.</p>
              <Link href="/produtos" className="btn">Ver todos os produtos</Link></div>
          )}
          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação">
              {page > 1 && <Link href={qs(sp, { pagina: String(page - 1) })} className={`${chip} ${off}`} rel="prev">‹ Anterior</Link>}
              {pageList(page, pages).map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1 text-mute">…</span> : <Link key={n} href={qs(sp, { pagina: String(n) })} aria-current={n === page ? "page" : undefined} className={`${chip} ${n === page ? on : off}`}>{n}</Link>)}
              {page < pages && <Link href={qs(sp, { pagina: String(page + 1) })} className={`${chip} ${off}`} rel="next">Próxima ›</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
