"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateCart, getCartToken } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function addToCart(variantId: string, quantity: number): Promise<{ ok: boolean; message: string }> {
  const parsed = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }).safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!v || !v.active || v.product.status !== "PUBLISHED") return { ok: false, message: "Produto indisponível." };
  const cart = await getOrCreateCart();
  const current = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
  const total = (current?.quantity ?? 0) + quantity;
  if (total > v.stock) return { ok: false, message: v.stock === 0 ? "Sem estoque." : `Estoque disponível: ${v.stock}.` };
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity }, update: { quantity: total },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Adicionado ao carrinho." };
}

export async function updateCartItem(formData: FormData) {
  const itemId = String(formData.get("itemId"));
  const qty = Math.max(0, Math.min(20, Number(formData.get("quantity")) || 0));
  const token = await getCartToken();
  if (!token) return;
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { token } }, include: { variant: true } });
  if (!item) return;
  if (qty === 0) await db.cartItem.delete({ where: { id: item.id } });
  else await db.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(qty, Math.max(item.variant.stock, 1)) } });
  revalidatePath("/", "layout");
}

export async function applyCoupon(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 40);
  const token = await getCartToken();
  if (!token || !code) return;
  if (!(await rateLimit(`coupon:${await clientIp()}`, 20, 600))) return;
  const exists = await db.coupon.findUnique({ where: { code } });
  await db.cart.update({ where: { token }, data: { couponCode: exists ? code : null } });
  revalidatePath("/carrinho");
}

export async function removeCoupon() {
  const token = await getCartToken();
  if (token) await db.cart.update({ where: { token }, data: { couponCode: null } });
  revalidatePath("/carrinho");
}
