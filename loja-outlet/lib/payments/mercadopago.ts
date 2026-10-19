import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { changeOrderStatus } from "../orders";
import { mpCreds } from "./config";

const API = "https://api.mercadopago.com";

export async function mpConfigured(): Promise<boolean> {
  return !!(await mpCreds());
}

type OrderForPref = { id: string; number: number; email: string; totalCents: number };

/** Cria preferência (Checkout Pro). O valor vem do pedido salvo no servidor. */
export async function createPreference(order: OrderForPref, baseUrl: string): Promise<string> {
  const creds = await mpCreds();
  if (!creds) throw new Error("Gateway não configurado.");
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json", "X-Idempotency-Key": order.id },
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
  const creds = await mpCreds();
  if (!creds) throw new Error("Gateway não configurado.");
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
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
  // liga a cobrança criada no checkout (sem id externo ainda) ao pagamento real, em vez de duplicar o registro
  const known = await db.payment.findUnique({ where: { provider_externalId: { provider: "mercadopago", externalId: String(p.id) } } });
  const pre = known ? null : await db.payment.findFirst({ where: { orderId: order.id, provider: "mercadopago", externalId: null } });
  const paidAt = status === "APPROVED" ? new Date() : undefined;
  const payment = pre
    ? await db.payment.update({ where: { id: pre.id }, data: { externalId: String(p.id), status, paidAt } })
    : await db.payment.upsert({
        where: { provider_externalId: { provider: "mercadopago", externalId: String(p.id) } },
        create: { orderId: order.id, customerId: order.customerId, provider: "mercadopago", externalId: String(p.id), method: p.payment_method_id, status, amountCents: order.totalCents, paidAt },
        update: { status, paidAt },
      });
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: status } });
  if (status === "APPROVED") {
    // Pagamento aprovado depois de o pedido ter sido cancelado/expirado: não reativa sozinho; deixa aviso para o atendimento.
    await changeOrderStatus(order.id, "PAID", "mercadopago", `Pagamento ${payment.externalId} aprovado`).catch(async () => {
      if (order.status !== "PAID") {
        await db.orderHistory.create({ data: { orderId: order.id, status: "ATENCAO", note: `Pagamento ${payment.externalId} aprovado com o pedido em ${order.status}: reembolsar ou reprocessar manualmente.`, actor: "mercadopago" } });
      }
    });
  }
  // Pagamento recusado NÃO cancela o pedido: o cliente pode tentar de novo; o cron expira pedidos não pagos em 48h.
  if (status === "REFUNDED") await changeOrderStatus(order.id, "REFUNDED", "mercadopago", "Estorno").catch(() => undefined);
  return "processed";
}

/** Webhook do Mercado Pago (usado pelas rotas /api/webhooks/mercadopago e /api/webhooks/payments/mercadopago). */
export async function handleMercadoPagoWebhook(req: import("next/server").NextRequest): Promise<Response> {
  const creds = await mpCreds();
  if (!creds?.webhookSecret) return Response.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = String(req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? "");
  if (!dataId) return Response.json({ error: "bad request" }, { status: 400 });
  if (!verifySignature({ signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id"), dataId, secret: creds.webhookSecret })) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  const type = req.nextUrl.searchParams.get("type") ?? body.type;
  if (type && type !== "payment") return Response.json({ ok: true, ignored: true });
  try {
    return Response.json({ ok: true, result: await processPayment(dataId) });
  } catch (e) {
    console.error("webhook mp", e instanceof Error ? e.message : "erro");
    return Response.json({ error: "processing failed" }, { status: 500 }); // o gateway fará nova tentativa
  }
}
