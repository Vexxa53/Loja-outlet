import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { orderFilter } from "@/lib/order-filter";
import { brl, dateBR } from "@/lib/money";
import { METHOD_LABEL, orderLabel, PAY_STATUS_LABEL, type PayStatus } from "@/lib/payments/types";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("orders.read");
  const sp = await searchParams;
  const orders = await db.order.findMany({ where: orderFilter(sp), orderBy: { createdAt: "desc" }, take: 200 });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="h-display text-2xl">Pedidos</h1><a className="btn btn-ghost" href={`/api/admin/export?${qs}`}>Exportar CSV</a></div>
      <form className="flex flex-wrap items-end gap-2"><input name="q" defaultValue={sp.q} placeholder="Nº, cliente ou e-mail" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[11rem]"><option value="">Status</option>{["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((s) => <option key={s}>{s}</option>)}</select>
        <select name="pagamento" defaultValue={sp.pagamento ?? ""} className="input max-w-[11rem]"><option value="">Pagamento</option>{(Object.keys(PAY_STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{PAY_STATUS_LABEL[s]}</option>)}</select>
        <input type="date" name="de" defaultValue={sp.de} className="input max-w-[10rem]" aria-label="De" /><input type="date" name="ate" defaultValue={sp.ate} className="input max-w-[10rem]" aria-label="Até" /><button className="btn">Filtrar</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Status</th><th>Forma</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>
        {orders.map((o) => (<tr key={o.id}><td><Link className="underline" href={`/admin/pedidos/${o.id}`}>{orderLabel(o.number)}</Link></td><td>{dateBR(o.createdAt)}</td><td>{o.customerName}<br /><span className="text-xs text-mute">{o.email}</span></td><td><span className="badge">{o.status}</span></td><td>{METHOD_LABEL[o.paymentMethod ?? "OTHER"]}</td><td>{PAY_STATUS_LABEL[o.paymentStatus as PayStatus]}</td><td>{brl(o.totalCents)}</td></tr>))}
        {!orders.length && <tr><td colSpan={7} className="text-center text-mute">Nenhum pedido.</td></tr>}</tbody></table></div></div>
  );
}
