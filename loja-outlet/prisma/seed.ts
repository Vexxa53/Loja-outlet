// Cria perfis padrão (sempre) e, com SEED_DEMO=1, dados de demonstração (NUNCA usar em produção real).
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../lib/permissions";

const db = new PrismaClient();

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({
      where: { name: r.name },
      create: { name: r.name, label: r.label, permissions: r.permissions, system: true },
      update: r.name === "admin" ? { permissions: r.permissions, label: r.label } : { label: r.label }, // preserva ajustes feitos no painel
    });
  }
  console.log("Perfis padrão garantidos.");
  if (process.env.SEED_DEMO !== "1") return;

  const cat = await db.category.upsert({ where: { slug: "camisetas" }, update: {}, create: { name: "Camisetas", slug: "camisetas", position: 1 } });
  const cat2 = await db.category.upsert({ where: { slug: "moletons" }, update: {}, create: { name: "Moletons", slug: "moletons", position: 2 } });
  await db.banner.deleteMany({ where: { title: "DEMO — Coleção street" } });
  await db.banner.create({ data: { title: "DEMO — Coleção street", subtitle: "Imagem de demonstração; troque no painel.", ctaLabel: "Comprar", link: "/produtos", imageUrl: "/demo/banner.svg" } });
  const items = [
    ["Camiseta Oversized Preta", "DEMO-CAM-001", cat.id, 14990, 9990, 1],
    ["Camiseta Boxy Grafite", "DEMO-CAM-002", cat.id, 12990, null, 2],
    ["Moletom Canguru Amarelo", "DEMO-MOL-001", cat2.id, 24990, 19990, 3],
    ["Moletom Zip Preto", "DEMO-MOL-002", cat2.id, 27990, null, 4],
  ] as const;
  for (const [name, sku, categoryId, price, promo, n] of items) {
    if (await db.product.findUnique({ where: { sku } })) continue;
    await db.product.create({
      data: {
        name, sku, slug: sku.toLowerCase(), categoryId, priceCents: price, promoPriceCents: promo, costCents: Math.round(price * 0.4), status: "PUBLISHED", featured: true, isNew: true,
        description: "Produto de demonstração.", images: { create: [{ url: `/demo/p${n}.svg`, position: 0 }] },
        variants: { create: ["P", "M", "G"].map((size) => ({ size, color: "Preto", sku: `${sku}-${size}`, stock: 10 })) },
      },
    });
  }
  await db.coupon.upsert({ where: { code: "BEMVINDO10" }, update: {}, create: { code: "BEMVINDO10", type: "PERCENT", value: 10 } });
  console.log("Dados de demonstração criados.");
}

main().finally(() => db.$disconnect());
