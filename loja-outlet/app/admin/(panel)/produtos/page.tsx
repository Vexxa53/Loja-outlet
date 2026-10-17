import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { Flash } from "@/components/Flash";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ok?: string; erro?: string }> }) {
  await requireAdmin("products.write");
  const sp = await searchParams;
  const products = await db.product.findMany({
    where: { ...(sp.status ? { status: sp.status as never } : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    include: { variants: true, images: { take: 1, orderBy: { position: "asc" } }, category: true }, orderBy: { updatedAt: "desc" }, take: 200,
  });
  return (
    <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="h-display text-2xl">Produtos</h1><Link className="btn" href="/admin/produtos/novo">Novo produto</Link></div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Nome ou SKU" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[10rem]"><option value="">Todos</option><option value="PUBLISHED">Publicados</option><option value="DRAFT">Rascunhos</option><option value="ARCHIVED">Arquivados</option></select><button className="btn btn-ghost">Buscar</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th></th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th></tr></thead><tbody>
        {products.map((p) => (<tr key={p.id}><td>{ }{p.images[0] ? <img src={p.images[0].url} alt="" className="h-12 w-10 object-cover" /> : null}</td>
          <td><Link className="underline" href={`/admin/produtos/${p.id}`}>{p.name}</Link></td><td>{p.sku}</td><td>{p.category?.name ?? "—"}</td><td>{brl(effectivePrice(p))}</td>
          <td>{p.variants.reduce((s, v) => s + v.stock, 0)}</td><td><span className="badge">{p.status}</span></td></tr>))}
        {!products.length && <tr><td colSpan={7} className="text-center text-mute">Nenhum produto.</td></tr>}</tbody></table></div></div>
  );
}
