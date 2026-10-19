import { db } from "./db";
import type { Prisma } from "@prisma/client";
import { discountPercent, effectivePrice } from "./pricing";
import { sortSizes } from "./nav";

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
  disponivel?: string; promo?: string; novo?: string; ordem?: string; pagina?: string; col?: string;
};
export const PAGE_SIZE = 12;

function whereFrom(sp: CatalogQuery, skip?: "categoria"): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [live];
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }, { category: { name: { contains: sp.q, mode: "insensitive" } } }] });
  if (sp.categoria && skip !== "categoria") and.push({ category: { slug: sp.categoria } });
  const min = sp.min ? Math.round(Number(sp.min.replace(",", ".")) * 100) : null;
  const max = sp.max ? Math.round(Number(sp.max.replace(",", ".")) * 100) : null;
  if (min != null && !Number.isNaN(min)) and.push({ OR: [{ promoPriceCents: { gte: min }, AND: [{ promoPriceCents: { not: null } }] }, { promoPriceCents: null, priceCents: { gte: min } }] });
  if (max != null && !Number.isNaN(max)) and.push({ OR: [{ promoPriceCents: { lte: max, gt: 0 } }, { promoPriceCents: null, priceCents: { lte: max } }] });
  const vf: Prisma.VariantWhereInput = { active: true };
  if (sp.tamanho) vf.size = sp.tamanho;
  if (sp.cor) vf.color = sp.cor;
  if (sp.disponivel === "1") vf.stock = { gt: 0 };
  if (sp.tamanho || sp.cor || sp.disponivel === "1") and.push({ variants: { some: vf } });
  if (sp.promo === "1") and.push({ promoPriceCents: { not: null } });
  if (sp.novo === "1") and.push({ isNew: true });
  return { AND: and };
}

/** Ordenação feita sobre TODOS os resultados (não só a página), para a ordem ser coerente entre páginas. */
export async function searchCatalog(sp: CatalogQuery) {
  const where = whereFrom(sp);
  const rows = await db.product.findMany({ where, select: { id: true, priceCents: true, promoPriceCents: true, createdAt: true, featured: true }, take: 2000 });
  const eff = (r: (typeof rows)[number]) => effectivePrice(r);
  let ranked = rows;
  switch (sp.ordem) {
    case "recentes": ranked = [...rows].sort((a, b) => +b.createdAt - +a.createdAt); break;
    case "menor": ranked = [...rows].sort((a, b) => eff(a) - eff(b)); break;
    case "maior": ranked = [...rows].sort((a, b) => eff(b) - eff(a)); break;
    case "desconto": ranked = [...rows].sort((a, b) => discountPercent(b) - discountPercent(a) || +b.createdAt - +a.createdAt); break;
    case "vendidos": {
      const top = await bestSellers(200);
      const rank = new Map(top.map((p, i) => [p.id, i]));
      ranked = [...rows].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999) || +b.createdAt - +a.createdAt);
      break;
    }
    default: ranked = [...rows].sort((a, b) => Number(b.featured) - Number(a.featured) || +b.createdAt - +a.createdAt);
  }
  const total = ranked.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.pagina) || 1));
  const ids = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.id);
  const found = await db.product.findMany({ where: { id: { in: ids } }, include: productInclude });
  const products = ids.map((id) => found.find((p) => p.id === id)).filter((p): p is CardProduct => !!p);
  return { products, total, page, pages };
}

/** Opções dos filtros (com contagem de produtos por categoria dentro dos demais filtros ativos). */
export async function facets(sp: CatalogQuery = {}) {
  const [categories, variants, perCat] = await Promise.all([
    db.category.findMany({ where: { active: true, products: { some: live } }, orderBy: { position: "asc" } }),
    db.variant.findMany({ where: { active: true, product: live }, select: { size: true, color: true }, distinct: ["size", "color"] }),
    db.product.groupBy({ by: ["categoryId"], where: whereFrom(sp, "categoria"), _count: { _all: true } }),
  ]);
  const counts = new Map(perCat.map((r) => [r.categoryId, r._count._all]));
  return {
    categories: categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
    sizes: sortSizes([...new Set(variants.map((v) => v.size))]),
    colors: [...new Set(variants.map((v) => v.color))].sort((a, b) => a.localeCompare(b)),
  };
}
