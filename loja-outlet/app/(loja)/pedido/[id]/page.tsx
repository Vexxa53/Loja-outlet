import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { brl, dateBR } from "@/lib/money";
import { getCustomer } from "@/lib/auth";
import { getCheckoutOptions } from "@/lib/payments/config";
import { expireDuePayments } from "@/lib/payments/service";
import { METHOD_LABEL, orderLabel, PAY_STATUS_LABEL, type PayStatus } from "@/lib/payments/types";
import { PaymentPanel, RetryForm, TestPanel } from "./PaymentPanel";

export const metadata = { title: "Pedido", robots: { index: false } };

const STATUS: Record<string, string> = { PENDING: "Aguardando pagamento", PAID: "Pago", PROCESSING: "Em separação", SHIPPED: "Enviado", DELIVERED: "Entregue", CANCELLED: "Cancelado", REFUNDED: "Reembolsado" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ id }, { r }, customer] = await Promise.all([params, searchParams, getCustomer()]);
  await expireDuePayments(id);
  const o = await db.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" } } } });
  // pedidos de clientes logados só podem ser vistos pelo dono
  if (!o || (o.customerId && o.customerId !== customer?.id)) notFound();
  const pay = o.payments[0] ?? null;
  const opts = await getCheckoutOptions();
  const ps = (pay?.status ?? o.paymentStatus) as PayStatus;
  const label = orderLabel(o.number);

  let headline: string; let next: string;
  if (ps === "APPROVED" || o.status === "PAID" || r === "sucesso") { headline = `Pedido ${label} confirmado. Pagamento aprovado!`; next = "Estamos separando seu pedido. Você acompanha o envio por aqui."; }
  else if (o.status === "CANCELLED") { headline = `Pedido ${label} cancelado.`; next = ps === "EXPIRED" ? "O prazo de pagamento terminou. Você pode refazer a compra quando quiser." : "Se ainda quiser as peças, faça um novo pedido."; }
  else if (ps === "REFUNDED") { headline = `Pedido ${label} estornado.`; next = "O valor será devolvido conforme a forma de pagamento usada."; }
  else if (ps === "REJECTED") { headline = `Pagamento do pedido ${label} recusado.`; next = "Tente novamente com outra forma de pagamento abaixo."; }
  else if (ps === "PROCESSING") { headline = `Pedido ${label} criado. Pagamento em análise.`; next = "Aguarde a confirmação. Atualizaremos esta página."; }
  else if (!pay || pay.provider === "manual") { headline = `Pedido ${label} criado com sucesso. Aguardando pagamento.`; next = "O recebimento online ainda não está ativo nesta loja. A loja vai confirmar seu pagamento e entrar em contato."; }
  else { headline = `Pedido ${label} criado com sucesso. Aguardando pagamento.`; next = pay.method === "PIX" ? "Pague com o PIX copia e cola abaixo antes do prazo." : "Informe os dados do cartão abaixo para concluir."; }

  const canRetry = o.status === "PENDING" && ps === "REJECTED";
  return (
    <div className="container-x max-w-3xl space-y-4 py-8">
      <p className="flash" role="status">{headline}</p>
      <h1 className="h-display text-3xl">Pedido {label}</h1>
      <p className="text-sm text-mute">{dateBR(o.createdAt)} · <span className="badge badge-accent">{STATUS[o.status]}</span></p>

      <section className="card space-y-3 p-4 text-sm" aria-labelledby="pay-h">
        <h2 id="pay-h" className="label">Pagamento</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-mute">Forma</dt><dd>{METHOD_LABEL[pay?.method ?? o.paymentMethod ?? "OTHER"]}{pay && pay.installments > 1 && ` em ${pay.installments}x de ${brl(pay.installmentCents ?? 0)}`}</dd></div>
          <div><dt className="text-mute">Status do pagamento</dt><dd><span className="badge">{PAY_STATUS_LABEL[ps]}</span>{pay?.isTest && <span className="badge ml-1">TESTE</span>}</dd></div>
          <div><dt className="text-mute">Valor total</dt><dd className="font-bold">{brl(o.totalCents)}</dd></div>
          <div><dt className="text-mute">Próximo passo</dt><dd>{next}</dd></div>
        </dl>
        {pay && !["APPROVED", "REFUNDED", "CANCELLED", "EXPIRED"].includes(pay.status) && pay.status !== "REJECTED" && pay.provider !== "manual" && (
          <PaymentPanel orderId={o.id} totalCents={o.totalCents} rule={opts.rule} testMode={opts.mode === "TEST"}
            payment={{ id: pay.id, method: pay.method, status: pay.status, isTest: pay.isTest, provider: pay.provider, installments: pay.installments, pixCopyPaste: pay.pixCopyPaste, expiresAt: pay.expiresAt?.toISOString() ?? null }} />
        )}
        {pay?.isTest && opts.mode === "TEST" && pay.status === "APPROVED" && <TestPanel orderId={o.id} />}
        {canRetry && <RetryForm orderId={o.id} methods={opts.methods} rule={opts.rule} totalCents={o.totalCents} />}
      </section>

      <div className="card p-4"><table className="tbl"><tbody>
        {o.items.map((i) => (<tr key={i.id}><td>{i.quantity}× {i.productName} ({i.color}/{i.size})</td><td className="text-right">{brl(i.totalCents)}</td></tr>))}
        <tr><td>Subtotal</td><td className="text-right">{brl(o.subtotalCents)}</td></tr>
        <tr><td>Frete ({o.shippingMethod})</td><td className="text-right">{brl(o.shippingCents)}</td></tr>
        {o.discountCents > 0 && <tr><td>Desconto {o.couponCode}</td><td className="text-right">-{brl(o.discountCents)}</td></tr>}
        <tr><td className="font-bold">Total</td><td className="text-right font-bold">{brl(o.totalCents)}</td></tr>
      </tbody></table></div>
      <div className="card p-4 text-sm"><p className="label">Entrega</p>{o.shipStreet}, {o.shipNumber} {o.shipComplement} — {o.shipDistrict}, {o.shipCity}/{o.shipState} · CEP {o.shipZip}
        {o.trackingCode && <p className="mt-2">Rastreio: <strong>{o.trackingCode}</strong></p>}</div>
      <div className="card p-4 text-sm"><p className="label">Acompanhamento</p><ul className="space-y-1">{o.history.map((h) => <li key={h.id}>{dateBR(h.createdAt)} — {STATUS[h.status] ?? h.status.replace("PAGAMENTO_", "Pagamento: ")}{h.note ? ` (${h.note})` : ""}</li>)}</ul></div>
      <Link href="/produtos" className="btn btn-ghost">Continuar comprando</Link>
    </div>
  );
}
