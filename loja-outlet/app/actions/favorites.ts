"use server";
import { db } from "@/lib/db";
import { productInclude, type CardProduct } from "@/lib/catalog";

/** Devolve os cartões dos produtos favoritados neste aparelho (apenas produtos públicos). */
export async function favoriteProducts(ids: string[]): Promise<CardProduct[]> {
  const clean = ids.filter((x) => typeof x === "string" && /^[a-z0-9]{10,40}$/i.test(x)).slice(0, 100);
  if (!clean.length) return [];
  return db.product.findMany({ where: { id: { in: clean }, status: { in: ["PUBLISHED", "UNAVAILABLE"] } }, include: productInclude });
}
