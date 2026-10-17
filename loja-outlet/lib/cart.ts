import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { effectivePrice, evaluateCoupon, quoteShipping, type CouponRule } from "./pricing";
import { getSettings } from "./settings";

const COOKIE = "lo_cart";

export async function getCartToken(create = false): Promise<string | null> {
  const jar = await cookies();
  let t = jar.get(COOKIE)?.value ?? null;
  if (!t && create) {
    t = randomBytes(24).toString("hex");
    jar.set(COOKIE, t, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return t;
}

export async function getOrCreateCart() {
  const token = (await getCartToken(true))!;
  return db.cart.upsert({ where: { token }, create: { token }, update: {} });
}

export type PricedLine = {
  itemId: string;
  variantId: string;
  productId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitCents: number;
  listCents: number;
  quantity: number;
  stock: number;
  totalCents: number;
  problem: string | null;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  couponError: string | null;
  valid: boolean;
};

/** Calcula SEMPRE a partir do banco: preços e estoque nunca vêm do navegador. */
export async function priceCart(customerId?: string | null, email?: string | null): Promise<PricedCart> {
  const token = await getCartToken();
  const empty: PricedCart = { lines: [], subtotalCents: 0, discountCents: 0, couponCode: null, couponError: null, valid: false };
  if (!token) return empty;
  const cart = await db.cart.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { variant: { include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } } },
      },
    },
  });
  if (!cart) return empty;
  const lines: PricedLine[] = cart.items.map((it) => {
    const v = it.variant;
    const p = v.product;
    const unit = effectivePrice(p);
    let problem: string | null = null;
    if (p.status !== "PUBLISHED" || !v.active) problem = "Produto indisponível.";
    else if (v.stock < it.quantity) problem = v.stock === 0 ? "Sem estoque." : `Apenas ${v.stock} em estoque.`;
    return {
      itemId: it.id, variantId: v.id, productId: p.id, categoryId: p.categoryId, name: p.name, slug: p.slug,
      sku: v.sku, size: v.size, color: v.color, imageUrl: p.images[0]?.url ?? null,
      unitCents: unit, listCents: p.priceCents, quantity: it.quantity, stock: v.stock,
      totalCents: unit * it.quantity, problem,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
  let discount = 0;
  let couponError: string | null = null;
  if (cart.couponCode) {
    const r = await checkCoupon(cart.couponCode, lines, customerId ?? null, email ?? null);
    if (r.ok) discount = r.discountCents;
    else couponError = r.error;
  }
  return {
    lines, subtotalCents: subtotal, discountCents: discount,
    couponCode: couponError ? null : cart.couponCode, couponError,
    valid: lines.length > 0 && lines.every((l) => !l.problem),
  };
}

export async function checkCoupon(code: string, lines: { productId: string; categoryId: string | null; totalCents: number }[], customerId: string | null, email: string | null) {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c) return { ok: false as const, error: "Cupom não encontrado." };
  const total = await db.couponUse.count({ where: { couponId: c.id } });
  const byCustomer =
    customerId || email
      ? await db.couponUse.count({ where: { couponId: c.id, OR: [...(customerId ? [{ customerId }] : []), ...(email ? [{ email }] : [])] } })
      : 0;
  return evaluateCoupon(c as CouponRule, lines, { total, byCustomer });
}

export async function shippingFor(zip: string, subtotalCents: number) {
  const s = await getSettings();
  return quoteShipping(zip, subtotalCents, s.shipping);
}
