import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { changeOrderStatus } from "../orders";

const API = "https://api.mercadopago.com";

export function mpConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

type OrderForPref = { id: string; number: number; email: string; totalCents: number };

/** Cria preferência (Checkout Pro). O valor vem do pedido salvo no servidor. */
export async function createPreference(order: OrderForPref, baseUrl: string): Promise<string> {
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": order.id },
    body: JSON.stringify({
      items: [{ title: `Pedido #${order.number}`, quantity: 1, unit_price: order.totalCents / 100, currency_id: "BRL" }],
      payer: { email: order.email },
      external_reference: order.id,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${baseUrl}/pedido/${order.id}?r=sucesso`,
        failure: `${baseUrl}/pedido/${order.id}?r=falha`,
        pending: `${baseUrl}/pedido/${order.id}?r=pendente`,
      },
      auto_return: "approved",
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago recusou a preferência (${res.status}).`);
  const data = (await res.json()) as { init_point: string };
  return data.init_point;
}

/** Valida x-signature (ts, v1) conforme documentação do Mercado Pago. */
export function verifySignature(opts: { signature: string | null; requestId: string | null; dataId: string; secret: string }): boolean {
  if (!opts.signature) return false;
  const parts = Object.fromEntries(opts.signature.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.requestId ?? ""};ts:${parts.ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

const MAP: Record<string, "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED" | "PENDING"> = {
  approved: "APPROVED", authorized: "PENDING", pending: "PENDING", in_process: "PENDING",
  rejected: "REJECTED", cancelled: "CANCELLED", refunded: "REFUNDED", charged_back: "REFUNDED",
};

/** Consulta o pagamento na API (fonte de verdade) e aplica no pedido, uma única vez por (id,status). */
export async function processPayment(paymentId: string): Promise<"processed" | "duplicate" | "ignored"> {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Falha ao consultar pagamento (${res.status})`);
  const p = (await res.json()) as { id: number; status: string; external_reference?: string; payment_method_id?: string; transaction_amount: number };
  const orderId = p.external_reference;
  const order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order) return "ignored";
  const status = MAP[p.status] ?? "PENDING";
  if (Math.round(p.transaction_amount * 100) !== order.totalCents && status === "APPROVED") return "ignored"; // valor divergente

  try {
    await db.paymentEvent.create({ data: { provider: "mercadopago", eventKey: `${p.id}:${p.status}`, status: p.status } });
  } catch {
    return "duplicate"; // violação do índice único = já processado
  }
  const payment = await db.payment.upsert({
    where: { provider_externalId: { provider: "mercadopago", externalId: String(p.id) } },
    create: { orderId: order.id, provider: "mercadopago", externalId: String(p.id), method: p.payment_method_id, status, amountCents: order.totalCents },
    update: { status, method: p.payment_method_id },
  });
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: status } });
  if (status === "APPROVED") await changeOrderStatus(order.id, "PAID", "mercadopago", `Pagamento ${payment.externalId} aprovado`).catch(() => undefined);
  if (status === "REJECTED" || status === "CANCELLED") await changeOrderStatus(order.id, "CANCELLED", "mercadopago", `Pagamento ${p.status}`).catch(() => undefined);
  if (status === "REFUNDED") await changeOrderStatus(order.id, "REFUNDED", "mercadopago", "Estorno").catch(() => undefined);
  return "processed";
}
