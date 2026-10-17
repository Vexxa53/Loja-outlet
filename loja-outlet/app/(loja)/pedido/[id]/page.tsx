import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { brl, dateBR } from "@/lib/money";
import { getCustomer } from "@/lib/auth";

export const metadata = { title: "Pedido", robots: { index: false } };

const STATUS: Record<string, string> = { PENDING: "Aguardando pagamento", PAID: "Pago", PROCESSING: "Em separação", SHIPPED: "Enviado", DELIVERED: "Entregue", CANCELLED: "Cancelado", REFUNDED: "Reembolsado" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ id }, { r }, customer] = await Promise.all([params, searchParams, getCustomer()]);
  const o = await db.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { createdAt: "asc" } } } });
  // pedidos de clientes logados só podem ser vistos pelo dono
  if (!o || (o.customerId && o.customerId !== customer?.id)) notFound();
  const banner = r === "sucesso" || o.paymentStatus === "APPROVED" ? "Pagamento aprovado. Obrigado pela compra!"
    : r === "falha" || o.paymentStatus === "REJECTED" ? "O pagamento não foi concluído. Você pode tentar novamente com outro meio."
    : "Pagamento pendente. Assim que for confirmado, atualizaremos seu pedido.";
  return (
    <div className="container-x max-w-3xl py-8 space-y-4">
      <p className="flash">{banner}</p>
      <h1 className="h-display text-3xl">Pedido #{o.number}</h1>
      <p className="text-sm text-mute">{dateBR(o.createdAt)} · <span className="badge badge-accent">{STATUS[o.status]}</span></p>
      <div className="card p-4"><table className="tbl"><tbody>
        {o.items.map((i) => (<tr key={i.id}><td>{i.quantity}× {i.productName} ({i.color}/{i.size})</td><td className="text-right">{brl(i.totalCents)}</td></tr>))}
        <tr><td>Frete ({o.shippingMethod})</td><td className="text-right">{brl(o.shippingCents)}</td></tr>
        {o.discountCents > 0 && <tr><td>Desconto {o.couponCode}</td><td className="text-right">-{brl(o.discountCents)}</td></tr>}
        <tr><td className="font-bold">Total</td><td className="text-right font-bold">{brl(o.totalCents)}</td></tr>
      </tbody></table></div>
      <div className="card p-4 text-sm"><p className="label">Entrega</p>{o.shipStreet}, {o.shipNumber} {o.shipComplement} — {o.shipDistrict}, {o.shipCity}/{o.shipState} · CEP {o.shipZip}
        {o.trackingCode && <p className="mt-2">Rastreio: <strong>{o.trackingCode}</strong></p>}</div>
      <div className="card p-4 text-sm"><p className="label">Acompanhamento</p><ul className="space-y-1">{o.history.map((h) => <li key={h.id}>{dateBR(h.createdAt)} — {STATUS[h.status] ?? h.status}{h.note ? ` (${h.note})` : ""}</li>)}</ul></div>
      <Link href="/produtos" className="btn btn-ghost">Continuar comprando</Link>
    </div>
  );
}
