import { db } from "../db";
import { changeOrderStatus, canTransition } from "../orders";
import { getCheckoutOptions, getPaymentConfig, integrationState } from "./config";
import { fakePix, newTransactionId, parseTestToken, validBrand } from "./gateways/test";
import { canPaymentTransition, installmentOptions, isActivePayment, METHOD_LABEL, PAY_STATUS_LABEL, type Method, type PayStatus } from "./types";

export class PaymentError extends Error {}

/**
 * Cria o registro de pagamento de um pedido. O valor SEMPRE vem do pedido salvo no servidor,
 * nunca do navegador. Reaproveita um pagamento ativo já existente (idempotente).
 */
export async function initPayment(p: { orderId: string; method: Method; installments?: number }) {
  const order = await db.order.findUnique({ where: { id: p.orderId } });
  if (!order) throw new PaymentError("Pedido não encontrado.");
  if (order.status !== "PENDING") throw new PaymentError("Este pedido não aceita novo pagamento.");
  const active = await db.payment.findFirst({ where: { orderId: order.id, status: { in: ["PENDING", "PROCESSING", "APPROVED"] } } });
  if (active) return active;

  const opts = await getCheckoutOptions();
  if (!opts.methods.some((m) => m.method === p.method)) throw new PaymentError("Forma de pagamento indisponível.");
  const cfg = await getPaymentConfig();
  let installments = 1;
  if (p.method === "CREDIT_CARD") {
    installments = p.installments ?? 1;
    if (!installmentOptions(order.totalCents, opts.rule).some((o) => o.n === installments)) throw new PaymentError("Número de parcelas inválido.");
  }
  const state = await integrationState(cfg);
  const txId = newTransactionId(order.number);
  const isTest = state.mode === "TEST";
  const provider = isTest ? "test" : state.mode === "LIVE" ? cfg.card.gateway : "manual";
  const pix = isTest && p.method === "PIX" ? fakePix(txId) : null;
  const expiresAt = p.method === "PIX" && state.mode !== "OFF" ? new Date(Date.now() + cfg.pix.expiresMinutes * 60_000) : null;

  const payment = await db.payment.create({
    data: {
      orderId: order.id, customerId: order.customerId, provider, method: p.method, status: "PENDING",
      amountCents: order.totalCents, installments, installmentCents: Math.ceil(order.totalCents / installments),
      transactionId: txId, isTest, expiresAt, pixCopyPaste: pix?.copyPaste ?? null, pixQrCode: pix?.qr ?? null,
    },
  });
  await db.order.update({ where: { id: order.id }, data: { paymentMethod: p.method, paymentStatus: "PENDING" } });
  await db.orderHistory.create({ data: { orderId: order.id, status: "PENDING", actor: isTest ? "teste" : "cliente", note: `Forma de pagamento: ${METHOD_LABEL[p.method]}${installments > 1 ? ` em ${installments}x` : ""}${isTest ? " (TESTE — sem cobrança real)" : ""}` } });
  return payment;
}

type Meta = { actor: string; note?: string; reason?: string; externalId?: string; amountCents?: number };

/**
 * Único ponto que muda o status de um pagamento. Garante:
 *  - transições válidas (máquina de estados) e idempotência;
 *  - aprovação só se o valor confere com o do pedido salvo no servidor;
 *  - o pedido acompanha o pagamento (pago / cancelado / reembolsado), com histórico.
 */
export async function applyPaymentStatus(paymentId: string, to: PayStatus, meta: Meta): Promise<{ changed: boolean }> {
  const result = await db.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!pay) throw new PaymentError("Pagamento não encontrado.");
    if (pay.status === to) return { changed: false, orderId: pay.orderId, pay };
    if (!canPaymentTransition(pay.status, to)) throw new PaymentError(`Transição inválida: ${PAY_STATUS_LABEL[pay.status as PayStatus]} → ${PAY_STATUS_LABEL[to]}.`);
    if (to === "APPROVED") {
      if (pay.amountCents !== pay.order.totalCents || (meta.amountCents != null && meta.amountCents !== pay.order.totalCents)) throw new PaymentError("Valor do pagamento diverge do valor do pedido.");
      if (pay.order.status !== "PENDING") throw new PaymentError(`Pedido está ${pay.order.status}; pagamento não pode ser aprovado automaticamente.`);
    }
    // updateMany com o status atual evita corrida entre duas notificações simultâneas
    const upd = await tx.payment.updateMany({
      where: { id: pay.id, status: pay.status },
      data: { status: to, failureReason: meta.reason ?? (to === "REJECTED" ? "Recusado" : pay.failureReason), externalId: meta.externalId ?? pay.externalId, ...(to === "APPROVED" ? { paidAt: new Date() } : {}) },
    });
    if (upd.count === 0) return { changed: false, orderId: pay.orderId, pay };
    await tx.order.update({ where: { id: pay.orderId }, data: { paymentStatus: to } });
    await tx.orderHistory.create({ data: { orderId: pay.orderId, status: `PAGAMENTO_${to}`, actor: meta.actor, note: `Pagamento ${PAY_STATUS_LABEL[to].toLowerCase()}${pay.isTest ? " (TESTE)" : ""}${meta.note ? ` — ${meta.note}` : ""}` } });
    return { changed: true, orderId: pay.orderId, pay };
  });
  if (!result.changed) return { changed: false };

  // O pedido acompanha o pagamento (fora da transação acima: changeOrderStatus tem a sua).
  const order = await db.order.findUnique({ where: { id: result.orderId } });
  if (!order) return { changed: true };
  if (to === "APPROVED" && canTransition(order.status, "PAID")) await changeOrderStatus(order.id, "PAID", meta.actor, `Pagamento ${result.pay.transactionId ?? ""} aprovado${result.pay.isTest ? " (TESTE)" : ""}`);
  if ((to === "CANCELLED" || to === "EXPIRED") && order.status === "PENDING") {
    const other = await db.payment.count({ where: { orderId: order.id, id: { not: result.pay.id }, status: { in: ["PENDING", "PROCESSING", "APPROVED"] } } });
    if (!other) await changeOrderStatus(order.id, "CANCELLED", meta.actor, to === "EXPIRED" ? "Pagamento expirado" : "Pagamento cancelado");
  }
  if (to === "REFUNDED" && canTransition(order.status, "REFUNDED")) await changeOrderStatus(order.id, "REFUNDED", meta.actor, "Pagamento estornado");
  return { changed: true };
}

/** Cartão de TESTE: recebe só o token + bandeira + 4 últimos dígitos. Nunca número, validade ou CVV. */
export async function chargeTestCard(p: { paymentId: string; token: string; brand: string; last4: string; installments: number }) {
  const scenario = parseTestToken(p.token);
  if (!scenario) throw new PaymentError("Token de cartão inválido.");
  if (!validBrand(p.brand) || !/^\d{4}$/.test(p.last4)) throw new PaymentError("Dados do cartão inválidos.");
  const pay = await db.payment.findUnique({ where: { id: p.paymentId }, include: { order: true } });
  if (!pay || !pay.isTest) throw new PaymentError("Pagamento de teste não encontrado.");
  if (!isActivePayment(pay.status) || (pay.method !== "CREDIT_CARD" && pay.method !== "DEBIT_CARD")) throw new PaymentError("Este pagamento não aceita cartão.");
  const opts = await getCheckoutOptions();
  const installments = pay.method === "CREDIT_CARD" ? p.installments : 1;
  if (!installmentOptions(pay.order.totalCents, opts.rule).some((o) => o.n === installments)) throw new PaymentError("Número de parcelas inválido.");
  await db.payment.update({ where: { id: pay.id }, data: { cardBrand: p.brand, cardLast4: p.last4, installments, installmentCents: Math.ceil(pay.amountCents / installments) } });
  if (scenario === "approved") return applyPaymentStatus(pay.id, "APPROVED", { actor: "teste", note: "Cartão de teste aprovado" });
  if (scenario === "declined") return applyPaymentStatus(pay.id, "REJECTED", { actor: "teste", reason: "Recusado pelo emissor (simulação)" });
  return applyPaymentStatus(pay.id, "PROCESSING", { actor: "teste", note: "Em análise (simulação)" });
}

export type Scenario = "approved" | "rejected" | "pending" | "expired" | "cancelled" | "refunded";
export const SCENARIO_TARGET: Record<Scenario, PayStatus> = { approved: "APPROVED", rejected: "REJECTED", pending: "PROCESSING", expired: "EXPIRED", cancelled: "CANCELLED", refunded: "REFUNDED" };
export const SCENARIO_LABEL: Record<Scenario, string> = { approved: "Pagamento aprovado", rejected: "Pagamento recusado", pending: "Pagamento pendente (em análise)", expired: "Pagamento expirado", cancelled: "Cancelamento", refunded: "Estorno" };

/** Simulação — só para pagamentos marcados como TESTE. Nunca toca em gateway real. */
export async function simulatePayment(paymentId: string, scenario: Scenario, actor: string) {
  const pay = await db.payment.findUnique({ where: { id: paymentId } });
  if (!pay || !pay.isTest) throw new PaymentError("A simulação só vale para pagamentos de TESTE.");
  return applyPaymentStatus(pay.id, SCENARIO_TARGET[scenario], { actor, note: "Simulação de teste", reason: scenario === "rejected" ? "Recusa simulada" : undefined });
}

/** Expira cobranças (PIX etc.) vencidas. Chamado pelo cron e ao abrir a página do pedido. */
export async function expireDuePayments(orderId?: string): Promise<number> {
  const due = await db.payment.findMany({ where: { status: { in: ["PENDING", "PROCESSING"] }, expiresAt: { lt: new Date() }, ...(orderId ? { orderId } : {}) }, select: { id: true }, take: 200 });
  let n = 0;
  for (const d of due) { try { const r = await applyPaymentStatus(d.id, "EXPIRED", { actor: "sistema", note: "Prazo de pagamento esgotado" }); if (r.changed) n++; } catch { /* segue */ } }
  return n;
}
