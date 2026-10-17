import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { dateBR } from "@/lib/money";
import { adjustStock } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; baixo?: string; ok?: string; erro?: string }> }) {
  await requireAdmin("stock.write");
  const sp = await searchParams;
  const all = await db.variant.findMany({
    where: sp.q ? { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { name: { contains: sp.q, mode: "insensitive" } } }] } : undefined,
    include: { product: { select: { name: true } } }, orderBy: [{ stock: "asc" }], take: 300,
  });
  const variants = sp.baixo ? all.filter((v) => v.stock <= v.minStock) : all;
  const moves = await db.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { variant: { include: { product: { select: { name: true } } } }, user: { select: { name: true } } } });
  return (
    <div className="space-y-6"><h1 className="h-display text-2xl">Estoque</h1><Flash ok={sp.ok} erro={sp.erro} />
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Produto ou SKU" className="input max-w-xs" /><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="baixo" value="1" defaultChecked={!!sp.baixo} /> Só estoque baixo</label><button className="btn btn-ghost">Filtrar</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Produto</th><th>Variação</th><th>SKU</th><th>Saldo</th><th>Mín.</th><th>Movimentar</th></tr></thead><tbody>
        {variants.map((v) => (<tr key={v.id}><td>{v.product.name}</td><td>{v.color}/{v.size}</td><td>{v.sku}</td><td className={v.stock <= v.minStock ? "font-bold text-accent" : ""}>{v.stock}</td><td>{v.minStock}</td>
          <td><form action={adjustStock} className="flex flex-wrap gap-1"><input type="hidden" name="variantId" value={v.id} />
            <select name="type" className="input !w-32" aria-label="Tipo"><option value="ENTRY">Entrada (+)</option><option value="EXIT">Saída (−)</option><option value="ADJUSTMENT">Definir saldo</option></select>
            <input name="quantity" type="number" min={0} className="input !w-20" required aria-label="Quantidade" /><input name="reason" placeholder="Motivo" className="input !w-40" required /><button className="btn !py-1.5">OK</button></form></td></tr>))}</tbody></table></div>
      <h2 className="font-bold uppercase">Últimas movimentações</h2>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Δ</th><th>Saldo</th><th>Motivo</th><th>Responsável</th></tr></thead><tbody>
        {moves.map((m) => (<tr key={m.id}><td>{dateBR(m.createdAt)}</td><td>{m.variant.product.name} ({m.variant.color}/{m.variant.size})</td><td>{m.type}</td><td>{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td>{m.balance}</td><td>{m.reason}</td><td>{m.user?.name ?? "sistema"}</td></tr>))}</tbody></table></div></div>
  );
}
