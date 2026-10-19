// Fluxo de pagamentos contra PostgreSQL real (INTEGRATION=1). Só modo TESTE/simulação: nenhuma cobrança real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createOrderFromCart } from "../lib/orders";
import { applyPaymentStatus, chargeTestCard, expireDuePayments, initPayment, PaymentError, simulatePayment } from "../lib/payments/service";
import { getPaymentConfig, savePaymentConfig } from "../lib/payments/config";

const run = process.env.INTEGRATION === "1";
const db = new PrismaClient();
const d = run ? describe : describe.skip;
const input = (key: string, extra: object = {}) => ({ name: "Fulano Teste", email: "pay@example.com", zip: "01310-100", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", state: "SP", idempotencyKey: `ptest-${key}`.padEnd(20, "0"), ...extra });

d("pagamentos (modo teste)", () => {
  let variantId = ""; let productId = ""; let original: Awaited<ReturnType<typeof getPaymentConfig>>;
  const tokens: string[] = [];
  async function newOrder(key: string, qty = 1) {
    const token = `ptest-${Math.random().toString(36).slice(2)}`; tokens.push(token);
    await db.cart.create({ data: { token, items: { create: [{ variantId, quantity: qty }] } } });
    return createOrderFromCart({ cartToken: token, customerId: null, input: input(key) });
  }
  beforeAll(async () => {
    original = await getPaymentConfig();
    process.env.AUTH_SECRET ||= "teste-secreto-1234567890";
    await savePaymentConfig({ ...original, mode: "TEST", pix: { ...original.pix, enabled: true }, card: { ...original.card, creditEnabled: true, debitEnabled: true, maxInstallments: 3, minInstallmentCents: 1000 } });
    const p = await db.product.create({ data: { name: "PTEST Produto", slug: `ptest-${Date.now()}`, sku: `PTEST-${Date.now()}`, priceCents: 10000, status: "PUBLISHED" } });
    productId = p.id;
    variantId = (await db.variant.create({ data: { productId: p.id, sku: `PTEST-V-${Date.now()}`, size: "M", color: "Preto", stock: 50 } })).id;
  });
  afterAll(async () => {
    await savePaymentConfig(original);
    await db.order.deleteMany({ where: { items: { some: { productId } } } });
    await db.cart.deleteMany({ where: { token: { in: tokens } } });
    await db.product.delete({ where: { id: productId } });
    await db.$disconnect();
  });

  it("PIX de teste: cria cobrança marcada TESTE, com código, expiração e valor do pedido", async () => {
    const o = await newOrder("pix1");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    expect(p.isTest).toBe(true); expect(p.provider).toBe("test");
    expect(p.amountCents).toBe(o.totalCents);
    expect(p.pixCopyPaste).toContain("TESTE"); expect(p.expiresAt).not.toBeNull(); expect(p.transactionId).toMatch(/^TX/);
    expect((await initPayment({ orderId: o.id, method: "PIX" })).id).toBe(p.id); // idempotente
    expect((await db.order.findUnique({ where: { id: o.id } }))!.paymentMethod).toBe("PIX");
  });

  it("aprovado → pedido PAGO; estorno → pedido REEMBOLSADO", async () => {
    const o = await newOrder("ap1");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    await simulatePayment(p.id, "approved", "teste");
    let cur = await db.order.findUnique({ where: { id: o.id } });
    expect(cur!.status).toBe("PAID"); expect(cur!.paymentStatus).toBe("APPROVED");
    expect((await db.payment.findUnique({ where: { id: p.id } }))!.paidAt).not.toBeNull();
    expect((await simulatePayment(p.id, "approved", "teste")).changed).toBe(false); // idempotente
    await simulatePayment(p.id, "refunded", "teste");
    cur = await db.order.findUnique({ where: { id: o.id } });
    expect(cur!.status).toBe("REFUNDED"); expect(cur!.paymentStatus).toBe("REFUNDED");
  });

  it("recusado mantém o pedido aguardando e permite novo pagamento", async () => {
    const o = await newOrder("rej1");
    const p = await initPayment({ orderId: o.id, method: "CREDIT_CARD", installments: 2 });
    expect(p.installments).toBe(2); expect(p.installmentCents).toBe(Math.ceil(o.totalCents / 2));
    await chargeTestCard({ paymentId: p.id, token: "tok_test_declined_abcdefgh", brand: "visa", last4: "0002", installments: 2 });
    const cur = await db.order.findUnique({ where: { id: o.id } });
    expect(cur!.status).toBe("PENDING"); expect(cur!.paymentStatus).toBe("REJECTED");
    const again = await initPayment({ orderId: o.id, method: "PIX" });
    expect(again.id).not.toBe(p.id);
    await simulatePayment(again.id, "approved", "teste");
    expect((await db.order.findUnique({ where: { id: o.id } }))!.status).toBe("PAID");
  });

  it("cartão: guarda só bandeira e 4 últimos dígitos; recusa token inválido", async () => {
    const o = await newOrder("card1");
    const p = await initPayment({ orderId: o.id, method: "DEBIT_CARD" });
    await expect(chargeTestCard({ paymentId: p.id, token: "4242424242424242", brand: "visa", last4: "4242", installments: 1 })).rejects.toBeInstanceOf(PaymentError);
    await expect(chargeTestCard({ paymentId: p.id, token: "tok_test_approved_abcdefgh", brand: "visa", last4: "42421", installments: 1 })).rejects.toBeInstanceOf(PaymentError);
    await chargeTestCard({ paymentId: p.id, token: "tok_test_approved_abcdefgh", brand: "visa", last4: "4242", installments: 1 });
    const row = await db.payment.findUnique({ where: { id: p.id } });
    expect(row!.cardBrand).toBe("visa"); expect(row!.cardLast4).toBe("4242"); expect(row!.status).toBe("APPROVED");
    expect(JSON.stringify(row)).not.toMatch(/\d{13,19}/);
  });

  it("pendente = processando; expirado e cancelado cancelam o pedido e repõem o estoque", async () => {
    const before = (await db.variant.findUnique({ where: { id: variantId } }))!.stock;
    const o = await newOrder("exp1", 2);
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    await simulatePayment(p.id, "pending", "teste");
    expect((await db.payment.findUnique({ where: { id: p.id } }))!.status).toBe("PROCESSING");
    await simulatePayment(p.id, "expired", "teste");
    expect((await db.order.findUnique({ where: { id: o.id } }))!.status).toBe("CANCELLED");
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(before);
    const o2 = await newOrder("can1");
    const p2 = await initPayment({ orderId: o2.id, method: "PIX" });
    await simulatePayment(p2.id, "cancelled", "teste");
    expect((await db.order.findUnique({ where: { id: o2.id } }))!.status).toBe("CANCELLED");
  });

  it("transições inválidas são bloqueadas (rejeitado não vira aprovado; estorno exige aprovado)", async () => {
    const o = await newOrder("inv1");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    await expect(simulatePayment(p.id, "refunded", "teste")).rejects.toBeInstanceOf(PaymentError);
    await simulatePayment(p.id, "rejected", "teste");
    await expect(simulatePayment(p.id, "approved", "teste")).rejects.toBeInstanceOf(PaymentError);
  });

  it("valor divergente não aprova; valor do pedido não muda depois de criado", async () => {
    const o = await newOrder("amt1");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    await expect(applyPaymentStatus(p.id, "APPROVED", { actor: "t", amountCents: o.totalCents - 1 })).rejects.toThrow(/diverge/);
    await db.payment.update({ where: { id: p.id }, data: { amountCents: o.totalCents - 100 } }); // adulteração simulada
    await expect(applyPaymentStatus(p.id, "APPROVED", { actor: "t" })).rejects.toThrow(/diverge/);
    expect((await db.order.findUnique({ where: { id: o.id } }))!.status).toBe("PENDING");
  });

  it("não aprova pagamento de pedido já cancelado; simulação só vale para TESTE", async () => {
    const o = await newOrder("canc2");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    await db.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
    await expect(applyPaymentStatus(p.id, "APPROVED", { actor: "t" })).rejects.toThrow();
    const o2 = await newOrder("real1");
    const real = await db.payment.create({ data: { orderId: o2.id, provider: "mercadopago", method: "PIX", amountCents: o2.totalCents, isTest: false } });
    await expect(simulatePayment(real.id, "approved", "x")).rejects.toThrow(/TESTE/);
  });

  it("parcelas inválidas e método desativado são recusados; cobrança vencida expira sozinha", async () => {
    const o = await newOrder("inst1");
    await expect(initPayment({ orderId: o.id, method: "CREDIT_CARD", installments: 9 })).rejects.toThrow(/parcelas/);
    const o2 = await newOrder("exp2");
    const p = await initPayment({ orderId: o2.id, method: "PIX" });
    await db.payment.update({ where: { id: p.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireDuePayments(o2.id)).toBe(1);
    expect((await db.order.findUnique({ where: { id: o2.id } }))!.status).toBe("CANCELLED");
    await savePaymentConfig({ ...(await getPaymentConfig()), pix: { ...original.pix, enabled: false } });
    const o3 = await newOrder("off1");
    await expect(initPayment({ orderId: o3.id, method: "PIX" })).rejects.toThrow(/indisponível/);
    await savePaymentConfig({ ...(await getPaymentConfig()), pix: { ...original.pix, enabled: true } });
  });

  it("modo não configurado: pagamento 'manual', sem cobrança real", async () => {
    await savePaymentConfig({ ...(await getPaymentConfig()), mode: "OFF" });
    const o = await newOrder("off2");
    const p = await initPayment({ orderId: o.id, method: "PIX" });
    expect(p.provider).toBe("manual"); expect(p.isTest).toBe(false); expect(p.pixCopyPaste).toBeNull();
    await savePaymentConfig({ ...(await getPaymentConfig()), mode: "TEST" });
  });
});
