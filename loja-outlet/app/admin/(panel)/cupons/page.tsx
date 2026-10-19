import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl } from "@/lib/money";
import { Flash } from "@/components/Flash";
import { saveCoupon, toggleCoupon } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("coupons.write");
  const sp = await searchParams;
  const [coupons, cats, prods] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { uses: true } } } }),
    db.category.findMany({ orderBy: { name: "asc" } }), db.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Cupons</h1><Flash ok={sp.ok} erro={sp.erro} />
      <form action={saveCoupon} className="card grid gap-2 p-4 md:grid-cols-4">
        <label className="block"><span className="label">Código</span><input name="code" className="input" required /></label>
        <label className="block"><span className="label">Tipo</span><select name="type" className="input"><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></select></label>
        <label className="block"><span className="label">Valor</span><input name="value" className="input" required /></label><label className="block"><span className="label">Pedido mínimo (R$)</span><input name="min" className="input" /></label>
        <label className="block"><span className="label">Início</span><input type="datetime-local" name="startsAt" className="input" /></label><label className="block"><span className="label">Validade</span><input type="datetime-local" name="expiresAt" className="input" /></label>
        <label className="block"><span className="label">Limite total de usos</span><input name="maxUses" type="number" min={0} className="input" /></label><label className="block"><span className="label">Limite por cliente</span><input name="maxUsesPerCustomer" type="number" min={0} className="input" /></label>
        <label className="block"><span className="label">Só categoria</span><select name="categoryId" className="input"><option value="">Todas</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="label">Só produto</span><select name="productId" className="input"><option value="">Todos</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Ativo</label><button className="btn">Criar cupom</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Código</th><th>Desconto</th><th>Mín.</th><th>Validade</th><th>Usos</th><th>Ativo</th></tr></thead><tbody>
        {coupons.map((c) => (<tr key={c.id}><td>{c.code}</td><td>{c.type === "PERCENT" ? `${c.value}%` : brl(c.value)}</td><td>{brl(c.minOrderCents)}</td><td>{c.expiresAt ? c.expiresAt.toLocaleDateString("pt-BR") : "—"}</td><td>{c._count.uses}{c.maxUses ? `/${c.maxUses}` : ""}</td>
          <td><form action={toggleCoupon}><input type="hidden" name="id" value={c.id} /><button className={`badge inline-flex min-h-11 items-center px-4 ${c.active ? "badge-accent" : ""}`}>{c.active ? "Ativo" : "Inativo"}</button></form></td></tr>))}</tbody></table></div></div>
  );
}
