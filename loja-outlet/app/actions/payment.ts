"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCustomer, getAdmin } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { getCheckoutOptions, integrationState } from "@/lib/payments/config";
import { applyPaymentStatus, chargeTestCard, initPayment, PaymentError, simulatePayment, SCENARIO_TARGET, type Scenario } from "@/lib/payments/service";
import { isMethod } from "@/lib/payments/config";

export type ActionResult = { ok: boolean; message: string };

/** O pedido só é acessível ao dono (se logado) ou por quem tem o link único (pedido de visitante). */
async function loadOrder(orderId: string) {
  const [order, customer] = await Promise.all([db.order.findUnique({ where: { id: orderId } }), getCustomer()]);
  if (!order || (order.customerId && order.customerId !== customer?.id)) throw new PaymentError("Pedido não encontrado.");
  return order;
}
const fail = (e: unknown): ActionResult => ({ ok: false, message: e instanceof PaymentError ? e.message : "Não foi possível processar. Tente novamente." });

async function testModeOnly() {
  if ((await integrationState()).mode !== "TEST") throw new PaymentError("O modo de teste não está ativo.");
}

/** Cartão de TESTE: só chega token + bandeira + 4 últimos dígitos. O navegador nunca envia número, validade ou CVV. */
export async function payWithTestCard(orderId: string, token: string, brand: string, last4: string, installments: number): Promise<ActionResult> {
  try {
    if (!(await rateLimit(`pay:${await clientIp()}`, 30, 600))) throw new PaymentError("Muitas tentativas. Aguarde alguns minutos.");
    await testModeOnly();
    const order = await loadOrder(orderId);
    const pay = await db.payment.findFirst({ where: { orderId: order.id, isTest: true, status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { createdAt: "desc" } });
    if (!pay) throw new PaymentError("Não há pagamento de cartão aguardando.");
    await chargeTestCard({ paymentId: pay.id, token, brand, last4, installments });
    revalidatePath(`/pedido/${order.id}`);
    return { ok: true, message: "Pagamento processado (TESTE)." };
  } catch (e) { return fail(e); }
}

/** Simulação feita pelo próprio cliente na tela do pedido — só em modo de teste e em pagamentos marcados como TESTE. */
export async function simulateAsCustomer(orderId: string, scenario: Scenario): Promise<ActionResult> {
  try {
    if (!(scenario in SCENARIO_TARGET)) throw new PaymentError("Cenário inválido.");
    if (!(await rateLimit(`sim:${await clientIp()}`, 60, 600))) throw new PaymentError("Muitas tentativas. Aguarde alguns minutos.");
    await testModeOnly();
    const order = await loadOrder(orderId);
    const pay = await db.payment.findFirst({ where: { orderId: order.id, isTest: true }, orderBy: { createdAt: "desc" } });
    if (!pay) throw new PaymentError("Não há pagamento de teste neste pedido.");
    await simulatePayment(pay.id, scenario, "teste");
    revalidatePath(`/pedido/${order.id}`);
    return { ok: true, message: "Simulação aplicada (TESTE)." };
  } catch (e) { return fail(e); }
}

/** Novo pagamento depois de uma recusa (o pedido continua aguardando). */
export async function retryPayment(orderId: string, method: string, installments: number): Promise<ActionResult> {
  try {
    if (!isMethod(method)) throw new PaymentError("Forma de pagamento inválida.");
    if (!(await rateLimit(`retry:${await clientIp()}`, 20, 600))) throw new PaymentError("Muitas tentativas. Aguarde alguns minutos.");
    const order = await loadOrder(orderId);
    await initPayment({ orderId: order.id, method, installments });
    revalidatePath(`/pedido/${order.id}`);
    return { ok: true, message: "Nova forma de pagamento criada." };
  } catch (e) { return fail(e); }
}

/** Opções públicas para o formulário de nova tentativa (sem segredos). */
export async function paymentOptionsPublic() {
  const o = await getCheckoutOptions();
  return { methods: o.methods, rule: o.rule };
}

// ---------- painel administrativo ----------
export async function adminSimulate(formData: FormData) {
  const admin = await getAdmin();
  if (!admin || !admin.role.permissions.includes("orders.write")) return;
  const paymentId = String(formData.get("paymentId"));
  const scenario = String(formData.get("scenario")) as Scenario;
  const orderId = String(formData.get("orderId"));
  if (!(scenario in SCENARIO_TARGET)) return;
  try {
    await simulatePayment(paymentId, scenario, `admin:${admin.email}`);
    await audit(admin.id, "payment.simulate", "Payment", paymentId, { scenario });
  } catch { /* a mensagem aparece pelo histórico/estado; simulação inválida é ignorada */ }
  revalidatePath(`/admin/pedidos/${orderId}`);
}

/** Confirmação manual (quando o recebimento real ainda não está configurado). */
export async function adminConfirmManual(formData: FormData) {
  const admin = await getAdmin();
  if (!admin || !admin.role.permissions.includes("orders.write")) return;
  const paymentId = String(formData.get("paymentId"));
  const orderId = String(formData.get("orderId"));
  const pay = await db.payment.findUnique({ where: { id: paymentId } });
  if (!pay || pay.provider !== "manual") return;
  try {
    await applyPaymentStatus(paymentId, "APPROVED", { actor: `admin:${admin.email}`, note: "Confirmado manualmente pelo painel" });
    await audit(admin.id, "payment.manual_confirm", "Payment", paymentId, {});
  } catch { /* regra de negócio impediu */ }
  revalidatePath(`/admin/pedidos/${orderId}`);
}
