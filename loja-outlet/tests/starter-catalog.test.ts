// Integração: instala o catálogo inicial no PostgreSQL de TESTE com armazenamento local. INTEGRATION=1 npm test
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { installStarterBatch, STARTER_TOTAL } from "../lib/starter-catalog";
import { STARTER_CATALOG, STARTER_PREFIX } from "../catalog/starter-catalog";
import { LOCAL_DIR } from "../lib/storage";

const run = process.env.INTEGRATION === "1";
const db = new PrismaClient();
const d = run ? describe : describe.skip;

async function installAll() {
  let offset: number | null = 0;
  const total = { created: 0, skipped: 0, errors: [] as string[], stored: 0, linked: 0 };
  while (offset !== null) {
    const r = await installStarterBatch({ offset, limit: 6 });
    total.created += r.created; total.skipped += r.skipped; total.errors.push(...r.errors); total.stored += r.imagesStored; total.linked += r.imagesLinked;
    offset = r.next;
  }
  return total;
}

d("catálogo inicial", () => {
  beforeAll(async () => { process.env.STORAGE_DRIVER = "local"; await db.product.deleteMany({ where: { sku: { startsWith: STARTER_PREFIX } } }); });
  afterAll(async () => { await db.product.deleteMany({ where: { sku: { startsWith: STARTER_PREFIX } } }); await db.$disconnect(); });

  it("define 35 produtos distintos nas quantidades pedidas", () => {
    expect(STARTER_TOTAL).toBe(35);
    const by = (c: string) => STARTER_CATALOG.filter((p) => p.category === c).length;
    expect(by("camisas")).toBe(8); expect(by("calcas")).toBe(8); expect(by("tenis")).toBe(8); expect(by("blusas-e-jaquetas")).toBe(8); expect(by("relogios")).toBe(3);
    expect(new Set(STARTER_CATALOG.map((p) => p.name)).size).toBe(35);
    expect(new Set(STARTER_CATALOG.map((p) => p.sku)).size).toBe(35);
    expect(new Set(STARTER_CATALOG.map((p) => p.description)).size).toBe(35);
    for (const p of STARTER_CATALOG) { expect(p.priceCents).toBeGreaterThan(5000); expect(p.priceCents).toBeLessThan(60000); expect(p.name).not.toMatch(/nike|adidas|puma|lacoste|converse|jordan|off-white|apple|casio/i); }
  });

  it("instala tudo com fotos próprias e sem promoções inventadas", async () => {
    const r = await installAll();
    expect(r.created).toBe(35);
    expect(r.errors).toEqual([]);
    const products = await db.product.findMany({ where: { sku: { startsWith: STARTER_PREFIX } }, include: { images: true, variants: true, category: true } });
    expect(products).toHaveLength(35);
    const urls = new Set<string>();
    for (const p of products) {
      expect(p.images, p.sku).toHaveLength(1);
      urls.add(p.images[0].url);
      expect(existsSync(path.join(LOCAL_DIR, p.images[0].path!)), p.sku).toBe(true);
      expect(p.variants.length, p.sku).toBeGreaterThan(0);
      expect(p.variants.every((v) => v.stock > 0)).toBe(true);
      expect(p.promoPriceCents).toBeNull();
      expect(p.status).toBe("PUBLISHED");
    }
    expect(urls.size).toBe(35); // nenhuma imagem repetida
    const count = (slug: string) => products.filter((p) => p.category?.slug === slug).length;
    expect([count("camisas"), count("calcas"), count("tenis"), count("blusas-e-jaquetas"), count("relogios")]).toEqual([8, 8, 8, 8, 3]);
  });

  it("é idempotente e preserva edições do proprietário", async () => {
    await db.product.update({ where: { sku: "OUT3K-CAM-003" }, data: { name: "Nome editado pelo dono", priceCents: 12345 } });
    const r = await installAll();
    expect(r.created).toBe(0);
    expect(r.skipped).toBe(35);
    expect(await db.product.count({ where: { sku: { startsWith: STARTER_PREFIX } } })).toBe(35);
    const p = await db.product.findUniqueOrThrow({ where: { sku: "OUT3K-CAM-003" }, include: { images: true } });
    expect(p.name).toBe("Nome editado pelo dono");
    expect(p.priceCents).toBe(12345);
    expect(p.images).toHaveLength(1); // não duplicou a foto
  });

  it("repõe apenas a foto de um produto que ficou sem imagem", async () => {
    await db.productImage.deleteMany({ where: { product: { sku: "OUT3K-TEN-001" } } });
    const r = await installAll();
    expect(r.created).toBe(0);
    expect(await db.productImage.count({ where: { product: { sku: "OUT3K-TEN-001" } } })).toBe(1);
  });
});
