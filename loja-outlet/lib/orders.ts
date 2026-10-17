import { z } from "zod";
import { db } from "./db";
import { moveStock, StockError } from "./stock";
import { effectivePrice, evaluateCoupon, quoteShipping, type CouponRule } from "./pricing";
import { getSettings } from "./settings";

export const checkoutSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().max(20).optional(),
  zip: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2).toUpperCase(),
  idempotencyKey: z.string().min(16).max(80),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class OrderError extends Error {}

/**
 * Cria o pedido em uma única transação: valida preço/estoque no servidor,
 * baixa o estoque de forma atômica e grava o snapshot comercial dos itens.
 */
export async function createOrderFromCart(p: { cartToken: string; customerId: string | null; input: CheckoutInput }) {
  const existing = await db.order.findUnique({ where: { idempotencyKey: p.input.idempotencyKey } });
  if (existing) return existing;
  const settings = await getSettings();

  return db.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { token: p.cartToken },
      include: { items: { include: { variant: { include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } } } } },
    });
    if (!cart || cart.items.length === 0) throw new OrderError("Carrinho vazio.");

    const lines = cart.items.map((it) => {
      const v = it.variant;
      const pr = v.product;
      if (pr.status !== "PUBLISHED" || !v.active) throw new OrderError(`"${pr.name}" não está mais disponível.`);
      const unit = effectivePrice(pr);
      return { it, v, pr, unit, total: unit * it.quantity };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);

    let discount = 0;
    let coupon: { id: string } | null = null;
    if (cart.couponCode) {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Coupon" WHERE "code" = ${cart.couponCode} FOR UPDATE`;
      const c = rows[0] ? await tx.coupon.findUnique({ where: { id: rows[0].id } }) : null;
      if (!c) throw new OrderError("Cupom não encontrado.");
      const total = await tx.couponUse.count({ where: { couponId: c.id } });
      const byCustomer = await tx.couponUse.count({
        where: { couponId: c.id, OR: [{ email: p.input.email }, ...(p.customerId ? [{ customerId: p.customerId }] : [])] },
      });
      const r = evaluateCoupon(c as CouponRule, lines.map((l) => ({ productId: l.pr.id, categoryId: l.pr.categoryId, totalCents: l.total })), { total, byCustomer });
      if (!r.ok) throw new OrderError(r.error);
      discount = r.discountCents;
      coupon = c;
    }

    const ship = quoteShipping(p.input.zip, subtotal, settings.shipping);
    if (!ship) throw new OrderError("CEP inválido para cálculo de frete.");

    const order = await tx.order.create({
      data: {
        customerId: p.customerId,
        email: p.input.email,
        customerName: p.input.name,
        phone: p.input.phone || null,
        subtotalCents: subtotal,
        discountCents: discount,
        shippingCents: ship.priceCents,
        totalCents: subtotal - discount + ship.priceCents,
        couponCode: coupon ? cart.couponCode : null,
        shippingMethod: ship.label,
        shipZip: p.input.zip.replace(/\D/g, ""),
        shipStreet: p.input.street,
        shipNumber: p.input.number,
        shipComplement: p.input.complement || null,
        shipDistrict: p.input.district,
        shipCity: p.input.city,
        shipState: p.input.state,
        idempotencyKey: p.input.idempotencyKey,
        items: {
          create: lines.map((l) => ({
            productId: l.pr.id, variantId: l.v.id, productName: l.pr.name, sku: l.v.sku, size: l.v.size, color: l.v.color,
            imageUrl: l.pr.images[0]?.url ?? null, unitPriceCents: l.unit, quantity: l.it.quantity, totalCents: l.total,
          })),
        },
        history: { create: { status: "PENDING", note: "Pedido criado", actor: "cliente" } },
      },
    });

    try {
      for (const l of lines) {
        await moveStock(tx, { variantId: l.v.id, delta: -l.it.quantity, type: "SALE", reason: `Pedido #${order.number}`, orderId: order.id });
      }
    } catch (e) {
      if (e instanceof StockError) throw new OrderError("Um dos itens ficou sem estoque. Revise o carrinho.");
      throw e;
    }
    if (coupon) {
      await tx.couponUse.create({ data: { couponId: coupon.id, orderId: order.id, customerId: p.customerId, email: p.input.email, amountCents: discount } });
    }
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return order;
  }, { isolationLevel: "ReadCommitted", timeout: 15000 });
}

const FORWARD: Record<string, string[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: string, to: string): boolean {
  return FORWARD[from]?.includes(to) ?? false;
}

/** Atualiza status com histórico; repõe estoque em cancelamentos/reembolsos elegíveis (uma única vez). */
export async function changeOrderStatus(orderId: string, to: string, actor: string, note?: string, userId?: string | null) {
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) throw new OrderError("Pedido não encontrado.");
    if (o.status === to) return o;
    if (!canTransition(o.status, to)) throw new OrderError(`Transição inválida: ${o.status} → ${to}.`);
    const restore = (to === "CANCELLED" || to === "REFUNDED") && !o.stockRestored && o.status !== "SHIPPED" && o.status !== "DELIVERED";
    if (restore) {
      for (const it of o.items) {
        if (it.variantId) await moveStock(tx, { variantId: it.variantId, delta: it.quantity, type: "RETURN", reason: `Reposição - pedido #${o.number} (${to})`, userId, orderId: o.id });
      }
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: to as never, stockRestored: o.stockRestored || restore, history: { create: { status: to, note, actor } } },
    });
    return updated;
  });
}
