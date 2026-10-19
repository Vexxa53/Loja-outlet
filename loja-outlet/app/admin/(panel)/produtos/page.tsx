import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { Flash } from "@/components/Flash";

const STATUS: Record<string, string> = { PUBLISHED: "Ativo", DRAFT: "Inativo", UNAVAILABLE: "Indisponível", ARCHIVED: "Arquivado" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ok?: string; erro?: string }> }) {
  await requireAdmin("products.write");
  const sp = await searchParams;
  const products = await db.product.findMany({
    where: { ...(sp.status ? { status: sp.status as never } : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    include: { variants: true, images: { take: 1, orderBy: { position: "asc" } }, category: true }, orderBy: { updatedAt: "desc" }, take: 200,
  });
  const thumb = (url?: string) => url   ? <img src={url} alt="" className="h-14 w-11 shrink-0 object-cover" loading="lazy" /> : <span className="grid h-14 w-11 shrink-0 place-items-center bg-steel text-[10px] text-mute">sem foto</span>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="h-display text-2xl">Produtos</h1><Link className="btn" href="/admin/produtos/novo">+ Novo produto</Link></div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <form className="flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="Buscar por nome ou SKU" aria-label="Buscar" className="input min-w-0 flex-1 sm:max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Situação" className="input !w-auto"><option value="">Todas as situações</option><option value="PUBLISHED">Ativos</option><option value="DRAFT">Inativos</option><option value="UNAVAILABLE">Indisponíveis</option><option value="ARCHIVED">Arquivados</option></select><button className="btn btn-ghost">Buscar</button></form>
      {!products.length && <p className="card p-6 text-center text-mute">Nenhum produto encontrado. <Link className="text-accent underline" href="/admin/produtos/novo">Cadastre o primeiro produto.</Link></p>}
      {/* celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {products.map((p) => (
          <li key={p.id}><Link href={`/admin/produtos/${p.id}`} className="card flex items-center gap-3 p-3">
            {thumb(p.images[0]?.url)}
            <span className="min-w-0 flex-1"><strong className="block truncate">{p.name}</strong><span className="text-xs text-mute">{p.sku} · estoque {p.variants.reduce((s, v) => s + v.stock, 0)}</span></span>
            <span className="text-right"><span className="block font-bold text-accent">{brl(effectivePrice(p))}</span><span className="badge">{STATUS[p.status]}</span></span></Link></li>
        ))}
      </ul>
      {/* computador: tabela */}
      {products.length > 0 && (
        <div className="card hidden overflow-x-auto md:block"><table className="tbl"><thead><tr><th></th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Situação</th></tr></thead><tbody>
          {products.map((p) => (<tr key={p.id}><td>{thumb(p.images[0]?.url)}</td>
            <td><Link className="underline" href={`/admin/produtos/${p.id}`}>{p.name}</Link></td><td>{p.sku}</td><td>{p.category?.name ?? "—"}</td><td>{brl(effectivePrice(p))}</td>
            <td>{p.variants.reduce((s, v) => s + v.stock, 0)}</td><td><span className="badge">{STATUS[p.status]}</span></td></tr>))}</tbody></table></div>
      )}
    </div>
  );
}
