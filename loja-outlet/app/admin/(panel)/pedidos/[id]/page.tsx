import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdmin, requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { brl, dateBR } from "@/lib/money";
import { canTransition } from "@/lib/orders";
import { updateOrder } from "@/app/actions/admin-misc";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("orders.read");
  const admin = (await getAdmin())!;
  const canWrite = admin.role.permissions.includes("orders.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await db.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { createdAt: "desc" } }, payments: true } });
  if (!o) notFound();
  const next = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].filter((s) => canTransition(o.status, s));
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Pedido #{o.number} <span className="badge badge-accent">{o.status}</span></h1><Flash ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 text-sm space-y-1"><p className="label">Cliente</p><p>{o.customerName} · {o.email} · {o.phone}</p><p className="label mt-3">Entrega</p><p>{o.shipStreet}, {o.shipNumber} {o.shipComplement} — {o.shipDistrict}, {o.shipCity}/{o.shipState} · CEP {o.shipZip}</p><p>{o.shippingMethod}</p></div>
        <div className="card p-4 text-sm"><p className="label">Pagamento: {o.paymentStatus}</p>{o.payments.map((p) => <p key={p.id}>{p.provider} {p.externalId} {p.method} — {p.status}</p>)}{!o.payments.length && <p className="text-mute">Sem pagamento registrado.</p>}</div></div>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Item</th><th>SKU</th><th>Var.</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead><tbody>
        {o.items.map((i) => (<tr key={i.id}><td>{i.productName}</td><td>{i.sku}</td><td>{i.color}/{i.size}</td><td>{i.quantity}</td><td>{brl(i.unitPriceCents)}</td><td>{brl(i.totalCents)}</td></tr>))}
        <tr><td colSpan={5}>Subtotal</td><td>{brl(o.subtotalCents)}</td></tr><tr><td colSpan={5}>Desconto {o.couponCode}</td><td>-{brl(o.discountCents)}</td></tr><tr><td colSpan={5}>Frete</td><td>{brl(o.shippingCents)}</td></tr><tr><td colSpan={5} className="font-bold">Total</td><td className="font-bold">{brl(o.totalCents)}</td></tr></tbody></table></div>
      {canWrite && (<form action={updateOrder} className="card grid gap-3 p-4 md:grid-cols-4"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="currentTracking" value={o.trackingCode ?? ""} />
        <div><label className="label" htmlFor="status">Novo status</label><select id="status" name="status" className="input"><option value="">(manter)</option>{next.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="trackingCode">Rastreio</label><input id="trackingCode" name="trackingCode" defaultValue={o.trackingCode ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="note">Observação</label><input id="note" name="note" className="input" /></div><div className="flex items-end"><button className="btn w-full">Atualizar</button></div>
        <p className="text-xs text-mute md:col-span-4">Cancelar/reembolsar antes do envio repõe o estoque automaticamente. O reembolso financeiro deve ser feito no painel do Mercado Pago.</p></form>)}
      <div className="card p-4 text-sm"><p className="label">Histórico</p><ul className="space-y-1">{o.history.map((h) => <li key={h.id}>{dateBR(h.createdAt)} — <strong>{h.status}</strong> {h.note} <span className="text-mute">({h.actor})</span></li>)}</ul></div></div>
  );
}
