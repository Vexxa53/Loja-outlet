import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { effectivePrice } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Sugestões da busca (produtos e categorias). Somente produtos públicos; resposta enxuta. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  if (!(await rateLimit(`search:${await clientIp()}`, 120, 60))) return NextResponse.json({ products: [], categories: [] }, { status: 429 });
  const live = { in: ["PUBLISHED", "UNAVAILABLE"] as ("PUBLISHED" | "UNAVAILABLE")[] };
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: live, OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }] },
      select: { name: true, slug: true, priceCents: true, promoPriceCents: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    db.category.findMany({ where: { active: true, name: { contains: q, mode: "insensitive" }, products: { some: { status: live } } }, select: { name: true, slug: true }, take: 3 }),
  ]);
  return NextResponse.json({
    products: products.map((p) => ({ name: p.name, slug: p.slug, priceCents: effectivePrice(p), oldCents: effectivePrice(p) < p.priceCents ? p.priceCents : null, image: p.images[0]?.url ?? null })),
    categories,
  }, { headers: { "Cache-Control": "no-store" } });
}
