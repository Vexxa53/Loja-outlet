import { db } from "./db";
import { memoPerRequest } from "./memo";
import { groupCategories, type NavDepartment } from "./nav";

const live = { in: ["PUBLISHED", "UNAVAILABLE"] as ("PUBLISHED" | "UNAVAILABLE")[] };

/** Categorias com produtos, a foto de cada uma (da categoria ou do 1º produto) e o total — base do menu e dos blocos da home. */
export const getNavDepartments = memoPerRequest(async (): Promise<NavDepartment[]> => {
  const [cats, counts, firsts] = await Promise.all([
    db.category.findMany({ where: { active: true, products: { some: { status: live } } }, orderBy: { position: "asc" } }),
    db.product.groupBy({ by: ["categoryId"], where: { status: live }, _count: { _all: true } }),
    db.product.findMany({
      where: { status: live, categoryId: { not: null }, images: { some: {} } },
      select: { categoryId: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);
  const count = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const firstImg = new Map<string, string>();
  for (const f of firsts) if (f.categoryId && !firstImg.has(f.categoryId) && f.images[0]) firstImg.set(f.categoryId, f.images[0].url);
  return groupCategories(cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, image: c.imageUrl ?? firstImg.get(c.id) ?? null, count: count.get(c.id) ?? 0 })));
});
