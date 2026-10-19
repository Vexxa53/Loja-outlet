import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdmin, requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { brl, dateBR } from "@/lib/money";
import { canTransition } from "@/lib/orders";
import { updateOrder } from "@/app/actions/admin-misc";
import { adminConfirmManual, adminSimulate } from "@/app/actions/payment";
import { METHOD_LABEL, orderLabel, PAY_STATUS_LABEL, type PayStatus } from "@/lib/payments/types";
import { SCENARIO_LABEL, type Scenario } from "@/lib/payments/service";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("orders.read");
  const admin = (await getAdmin())!;
  const canWrite = admin.role.permissions.includes("orders.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await db.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { createdAt: "desc" } }, payments: true } });
  if (!o) notFound();
  const next = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].filter((s) => canTransition(o.status, s));
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Pedido {orderLabel(o.number)} <span className="badge badge-accent">{o.status}</span></h1><Flash ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 text-sm space-y-1"><p className="label">Cliente</p><p>{o.customerName} · {o.email} · {o.phone}</p><p className="label mt-3">Entrega</p><p>{o.shipStreet}, {o.shipNumber} {o.shipComplement} — {o.shipDistrict}, {o.shipCity}/{o.shipState} · CEP {o.shipZip}</p><p>{o.shippingMethod}</p></div>
        <div className="card p-4 text-sm space-y-1"><p className="label">Pedido</p><p>Forma de pagamento: <strong>{METHOD_LABEL[o.paymentMethod ?? "OTHER"]}</strong></p><p>Status do pagamento: <span className="badge">{PAY_STATUS_LABEL[o.paymentStatus as PayStatus]}</span></p><p>Criado em {dateBR(o.createdAt)} · atualizado em {dateBR(o.updatedAt)}</p></div></div>
      <section className="card space-y-3 overflow-x-auto p-4 text-sm" aria-label="Pagamentos do pedido"><p className="label">Pagamentos ({o.payments.length})</p>
        {!o.payments.length && <p className="text-mute">Sem pagamento registrado.</p>}
        {o.payments.map((p) => (
          <div key={p.id} className="space-y-2 border-t border-line pt-3">
            <p><strong>{METHOD_LABEL[p.method ?? "OTHER"]}</strong> · <span className="badge">{PAY_STATUS_LABEL[p.status as PayStatus]}</span> {p.isTest && <span className="badge badge-accent">TESTE</span>} · {brl(p.amountCents)}{p.installments > 1 && ` em ${p.installments}x de ${brl(p.installmentCents ?? 0)}`}</p>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-mute">Gateway</dt><dd>{p.provider}</dd></div>
              <div><dt className="text-mute">ID da transação</dt><dd className="break-all">{p.transactionId ?? "—"}</dd></div>
              <div><dt className="text-mute">ID externo (cobrança)</dt><dd className="break-all">{p.externalId ?? "—"}</dd></div>
              <div><dt className="text-mute">Criado</dt><dd>{dateBR(p.createdAt)}</dd></div>
              <div><dt className="text-mute">Pago em</dt><dd>{p.paidAt ? dateBR(p.paidAt) : "—"}</dd></div>
              <div><dt className="text-mute">Expira em</dt><dd>{p.expiresAt ? dateBR(p.expiresAt) : "—"}</dd></div>
              {p.cardBrand && <div><dt className="text-mute">Cartão</dt><dd>{p.cardBrand} •••• {p.cardLast4}</dd></div>}
              {p.failureReason && <div><dt className="text-mute">Motivo da recusa</dt><dd>{p.failureReason}</dd></div>}
            </dl>
            {canWrite && p.isTest && (
              <form action={adminSimulate} className="flex flex-wrap items-center gap-2"><input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="orderId" value={o.id} />
                <span className="text-xs font-bold text-accent">TESTE — simular:</span>
                {(Object.keys(SCENARIO_LABEL) as Scenario[]).map((sc) => <button key={sc} name="scenario" value={sc} className="btn btn-ghost !py-2">{SCENARIO_LABEL[sc]}</button>)}</form>
            )}
            {canWrite && p.provider === "manual" && p.status === "PENDING" && (
              <form action={adminConfirmManual}><input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="orderId" value={o.id} /><button className="btn btn-ghost">Confirmar recebimento manualmente</button> <span className="text-xs text-mute">Use só depois de conferir o dinheiro na sua conta.</span></form>
            )}
          </div>))}
      </section>
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
