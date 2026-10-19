"use server";
import { db } from "@/lib/db";
import { effectivePrice } from "@/lib/pricing";
import { shippingFor } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export type QuoteResult = { ok: true; label: string; priceCents: number; days: number } | { ok: false; message: string };

/** Calcula o frete de um produto pelo CEP (usa o preço real do servidor para a regra de frete grátis). */
export async function quoteForProduct(zip: string, productId: string): Promise<QuoteResult> {
  if (!/^\d{5}-?\d{3}$/.test(zip.trim())) return { ok: false, message: "Informe um CEP válido (8 números)." };
  if (!(await rateLimit(`quote:${await clientIp()}`, 60, 600))) return { ok: false, message: "Muitas consultas. Tente de novo em alguns minutos." };
  const p = await db.product.findFirst({ where: { id: productId, status: { in: ["PUBLISHED", "UNAVAILABLE"] } }, select: { priceCents: true, promoPriceCents: true } });
  if (!p) return { ok: false, message: "Produto não encontrado." };
  const q = await shippingFor(zip, effectivePrice(p));
  return q ? { ok: true, label: q.label, priceCents: q.priceCents, days: q.days } : { ok: false, message: "Não foi possível calcular o frete para este CEP." };
}
