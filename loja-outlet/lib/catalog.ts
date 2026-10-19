import { db } from "./db";
import type { Prisma } from "@prisma/client";
import { effectivePrice } from "./pricing";

export const productInclude = {
  images: { orderBy: { position: "asc" as const }, take: 1 },
  variants: { where: { active: true }, select: { stock: true, size: true, color: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const live: Prisma.ProductWhereInput = { status: { in: ["PUBLISHED", "UNAVAILABLE"] } };

export async function bestSellers(limit = 8): Promise<CardProduct[]> {
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 2,
  });
  const ids = rows.map((r) => r.productId!).filter(Boolean);
  if (!ids.length) return [];
  const products = await db.product.findMany({ where: { status: "PUBLISHED", id: { in: ids } }, include: productInclude });
  return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is CardProduct => !!p).slice(0, limit);
}

export const listFor = (where: Prisma.ProductWhereInput, take = 8, orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" }) =>
  db.product.findMany({ where: { ...live, ...where }, include: productInclude, orderBy, take });

export type CatalogQuery = {
  q?: string; categoria?: string; min?: string; max?: string; tamanho?: string; cor?: string;
  disponivel?: string; promo?: string; ordem?: string; pagina?: string;
};
export const PAGE_SIZE = 12;

export async function searchCatalog(sp: CatalogQuery) {
  const and: Prisma.ProductWhereInput[] = [live];
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }] });
  if (sp.categoria) and.push({ category: { slug: sp.categoria } });
  const min = sp.min ? Math.round(Number(sp.min) * 100) : null;
  const max = sp.max ? Math.round(Number(sp.max) * 100) : null;
  if (min != null && !Number.isNaN(min)) and.push({ OR: [{ promoPriceCents: { gte: min, lt: 1e9 }, AND: [{ promoPriceCents: { not: null } }] }, { promoPriceCents: null, priceCents: { gte: min } }] });
  if (max != null && !Number.isNaN(max)) and.push({ OR: [{ promoPriceCents: { lte: max, gt: 0 } }, { promoPriceCents: null, priceCents: { lte: max } }] });
  const vf: Prisma.VariantWhereInput = { active: true };
  if (sp.tamanho) vf.size = sp.tamanho;
  if (sp.cor) vf.color = sp.cor;
  if (sp.disponivel === "1") vf.stock = { gt: 0 };
  if (sp.tamanho || sp.cor || sp.disponivel === "1") and.push({ variants: { some: vf } });
  if (sp.promo === "1") and.push({ promoPriceCents: { not: null } });
  const where = { AND: and };
  const order: Record<string, Prisma.ProductOrderByWithRelationInput> = {
    recentes: { createdAt: "desc" }, menor: { priceCents: "asc" }, maior: { priceCents: "desc" },
  };
  const page = Math.max(1, Number(sp.pagina) || 1);
  const [total, raw] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: productInclude, orderBy: order[sp.ordem ?? ""] ?? [{ featured: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  let products = raw;
  if (sp.ordem === "menor" || sp.ordem === "maior") {
    // ordena pelo preço efetivo (promocional quando houver) dentro da página
    products = [...raw].sort((a, b) => (effectivePrice(a) - effectivePrice(b)) * (sp.ordem === "maior" ? -1 : 1));
  }
  if (sp.ordem === "vendidos") {
    const top = await bestSellers(60);
    const rank = new Map(top.map((p, i) => [p.id, i]));
    products = [...raw].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }
  return { products, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function facets() {
  const [categories, variants] = await Promise.all([
    db.category.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    db.variant.findMany({ where: { active: true, product: { status: { in: ["PUBLISHED", "UNAVAILABLE"] } } }, select: { size: true, color: true }, distinct: ["size", "color"] }),
  ]);
  return { categories, sizes: [...new Set(variants.map((v) => v.size))], colors: [...new Set(variants.map((v) => v.color))] };
}
