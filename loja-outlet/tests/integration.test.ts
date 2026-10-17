// Testes contra PostgreSQL real. Rode com: INTEGRATION=1 DATABASE_URL=... npm test  (usa dados com prefixo ITEST-, limpa ao final)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { changeOrderStatus, createOrderFromCart, OrderError } from "../lib/orders";
import { moveStock } from "../lib/stock";
import { processPayment } from "../lib/payments/mercadopago";

const run = process.env.INTEGRATION === "1";
const db = new PrismaClient();
const d = run ? describe : describe.skip;

const input = (key: string) => ({ name: "Fulano Teste", email: "teste@example.com", zip: "01310-100", street: "Rua A", number: "1", district: "Centro", city: "São Paulo", state: "SP", idempotencyKey: key.padEnd(20, "0") });

d("fluxo de pedidos (PostgreSQL)", () => {
  let variantId = "";
  let productId = "";
  const tokens: string[] = [];

  async function cartWith(qty: number, couponCode?: string) {
    const token = `itest-${Math.random().toString(36).slice(2)}`;
    tokens.push(token);
    await db.cart.create({ data: { token, couponCode: couponCode ?? null, items: { create: [{ variantId, quantity: qty }] } } });
    return token;
  }

  beforeAll(async () => {
    const p = await db.product.create({ data: { name: "ITEST Produto", slug: `itest-${Date.now()}`, sku: `ITEST-${Date.now()}`, priceCents: 10000, promoPriceCents: 8000, status: "PUBLISHED" } });
    productId = p.id;
    const v = await db.variant.create({ data: { productId: p.id, sku: `ITEST-V-${Date.now()}`, size: "M", color: "Preto", stock: 5 } });
    variantId = v.id;
    await db.coupon.upsert({ where: { code: "ITEST10" }, update: { maxUses: 1 }, create: { code: "ITEST10", type: "PERCENT", value: 10, maxUses: 1 } });
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { items: { some: { productId } } } });
    await db.cart.deleteMany({ where: { token: { in: tokens } } });
    await db.product.delete({ where: { id: productId } });
    await db.coupon.deleteMany({ where: { code: "ITEST10" } });
    await db.$disconnect();
  });

  it("usa preço do servidor, baixa estoque e grava snapshot", async () => {
    const o = await createOrderFromCart({ cartToken: await cartWith(2), customerId: null, input: input("snap") });
    expect(o.subtotalCents).toBe(16000); // 2 × promocional 80,00
    expect(o.shippingCents).toBe(1990);
    expect(o.totalCents).toBe(17990);
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(3);
    const item = (await db.orderItem.findMany({ where: { orderId: o.id } }))[0];
    await db.product.update({ where: { id: productId }, data: { name: "Nome alterado", priceCents: 99999 } });
    const after = await db.orderItem.findUnique({ where: { id: item.id } });
    expect(after!.productName).toBe("ITEST Produto");
    expect(after!.unitPriceCents).toBe(8000);
  });

  it("é idempotente pela chave do checkout", async () => {
    const t = await cartWith(1);
    const a = await createOrderFromCart({ cartToken: t, customerId: null, input: input("idem") });
    const b = await createOrderFromCart({ cartToken: t, customerId: null, input: input("idem") });
    expect(b.id).toBe(a.id);
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(2);
  });

  it("não vende acima do estoque sob concorrência", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 3 } });
    const tokensC = await Promise.all([cartWith(2), cartWith(2), cartWith(2)]);
    const results = await Promise.allSettled(tokensC.map((t, i) => createOrderFromCart({ cartToken: t, customerId: null, input: input(`conc${i}`) })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof OrderError)).toBe(true);
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(1);
  });

  it("respeita limite de uso do cupom", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 10 } });
    const a = await createOrderFromCart({ cartToken: await cartWith(1, "ITEST10"), customerId: null, input: input("cp1") });
    expect(a.discountCents).toBe(800);
    await expect(createOrderFromCart({ cartToken: await cartWith(1, "ITEST10"), customerId: null, input: input("cp2") })).rejects.toThrow(/esgotado/i);
  });

  it("cancelamento repõe estoque uma única vez e valida transições", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 10 } });
    const o = await createOrderFromCart({ cartToken: await cartWith(3), customerId: null, input: input("cancel") });
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(7);
    await changeOrderStatus(o.id, "CANCELLED", "teste");
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(10);
    await expect(changeOrderStatus(o.id, "REFUNDED", "teste")).rejects.toThrow(/inválida/i);
    expect((await db.variant.findUnique({ where: { id: variantId } }))!.stock).toBe(10);
    const movs = await db.stockMovement.findMany({ where: { orderId: o.id } });
    expect(movs.map((m) => m.type).sort()).toEqual(["RETURN", "SALE"]);
  });

  it("estoque nunca fica negativo", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 1 } });
    await expect(db.$transaction((tx) => moveStock(tx, { variantId, delta: -2, type: "EXIT", reason: "teste" }))).rejects.toThrow();
  });

  it("webhook: processPayment ignora pedido inexistente sem lançar", async () => {
    const orig = globalThis.fetch;
    process.env.MP_ACCESS_TOKEN = "x";
    globalThis.fetch = (async () => new Response(JSON.stringify({ id: 1, status: "approved", external_reference: "nao-existe", transaction_amount: 1 }))) as typeof fetch;
    try { expect(await processPayment("1")).toBe("ignored"); } finally { globalThis.fetch = orig; }
  });

  it("webhook: pagamento aprovado marca pedido pago e é idempotente", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 10 } });
    const o = await createOrderFromCart({ cartToken: await cartWith(1), customerId: null, input: input("pay") });
    const orig = globalThis.fetch;
    process.env.MP_ACCESS_TOKEN = "x";
    const pid = Math.floor(Math.random() * 1e9);
    globalThis.fetch = (async () => new Response(JSON.stringify({ id: pid, status: "approved", external_reference: o.id, transaction_amount: o.totalCents / 100, payment_method_id: "pix" }))) as typeof fetch;
    try {
      expect(await processPayment(String(pid))).toBe("processed");
      expect(await processPayment(String(pid))).toBe("duplicate");
    } finally { globalThis.fetch = orig; }
    const after = await db.order.findUnique({ where: { id: o.id }, include: { history: true } });
    expect(after!.status).toBe("PAID");
    expect(after!.paymentStatus).toBe("APPROVED");
    expect(after!.history.filter((h) => h.status === "PAID")).toHaveLength(1);
    await db.paymentEvent.deleteMany({ where: { eventKey: `${pid}:approved` } });
  });

  it("webhook: valor divergente não aprova", async () => {
    await db.variant.update({ where: { id: variantId }, data: { stock: 10 } });
    const o = await createOrderFromCart({ cartToken: await cartWith(1), customerId: null, input: input("diverge") });
    const orig = globalThis.fetch;
    process.env.MP_ACCESS_TOKEN = "x";
    globalThis.fetch = (async () => new Response(JSON.stringify({ id: 5, status: "approved", external_reference: o.id, transaction_amount: 0.01 }))) as typeof fetch;
    try { expect(await processPayment("5")).toBe("ignored"); } finally { globalThis.fetch = orig; }
    expect((await db.order.findUnique({ where: { id: o.id } }))!.status).toBe("PENDING");
  });
});
