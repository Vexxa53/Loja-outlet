import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { audit } from "./audit";
import { moveStock } from "./stock";
import { slugify } from "./slug";
import { storageConfigured, uploadImage } from "./storage";
import { STARTER_CATALOG, STARTER_CATEGORIES, STARTER_PREFIX } from "../catalog/starter-catalog";

export const STARTER_TOTAL = STARTER_CATALOG.length;

export type BatchResult = {
  total: number;
  next: number | null; // próximo deslocamento, ou null quando terminou
  created: number;
  skipped: number;
  imagesStored: number; // enviadas ao armazenamento persistente (Supabase)
  imagesLinked: number; // usando o arquivo empacotado em /catalogo (também persistente, vem com o deploy)
  errors: string[];
};

/** Lê a foto do catálogo: primeiro do disco (empacotada no deploy) e, se faltar, do próprio site. */
async function loadImage(sku: string, origin?: string): Promise<Buffer | null> {
  try { return await readFile(path.join(process.cwd(), "public", "catalogo", `${sku}.webp`)); } catch { /* tenta pela rede */ }
  if (origin) {
    try {
      const r = await fetch(`${origin}/catalogo/${sku}.webp`);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* sem imagem */ }
  }
  return null;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "produto";
  let slug = root;
  for (let i = 2; await db.product.findUnique({ where: { slug } }); i++) slug = `${root}-${i}`;
  return slug;
}

/**
 * Instala uma fatia do catálogo inicial. Idempotente: produto com o mesmo SKU nunca é duplicado nem sobrescrito
 * (as edições feitas no painel são preservadas); se existir sem foto, apenas a foto é adicionada.
 */
export async function installStarterBatch(opts: { offset: number; limit: number; origin?: string; userId?: string | null }): Promise<BatchResult> {
  const slice = STARTER_CATALOG.slice(opts.offset, opts.offset + opts.limit);
  const res: BatchResult = { total: STARTER_TOTAL, next: null, created: 0, skipped: 0, imagesStored: 0, imagesLinked: 0, errors: [] };

  for (const c of STARTER_CATEGORIES) {
    await db.category.upsert({ where: { slug: c.slug }, create: { slug: c.slug, name: c.name, position: c.position }, update: {} });
  }

  for (const p of slice) {
    try {
      let product = await db.product.findUnique({ where: { sku: p.sku }, include: { images: { select: { id: true } } } });
      if (product) {
        res.skipped++;
      } else {
        const category = await db.category.findUniqueOrThrow({ where: { slug: p.category } });
        const slug = await uniqueSlug(p.name);
        const created = await db.$transaction(async (tx) => {
          const row = await tx.product.create({
            data: {
              sku: p.sku, slug, name: p.name, description: p.description, categoryId: category.id, priceCents: p.priceCents, costCents: Math.round(p.priceCents * 0.5),
              status: "PUBLISHED", featured: !!p.featured, isNew: !!p.isNew,
            },
          });
          for (const size of p.sizes) {
            const v = await tx.variant.create({ data: { productId: row.id, sku: `${p.sku}-${slugify(size)}`.toUpperCase(), size, color: p.color, stock: 0, minStock: 2 } });
            await moveStock(tx, { variantId: v.id, delta: p.stock, type: "ENTRY", reason: "Catálogo inicial (demonstração)", userId: opts.userId });
          }
          return row;
        });
        product = { ...created, images: [] };
        res.created++;
      }

      if (product.images.length === 0) {
        const buf = await loadImage(p.sku, opts.origin);
        if (!buf) { res.errors.push(`${p.sku}: foto não encontrada`); continue; }
        let url = `/catalogo/${p.sku}.webp`;
        let objectPath: string | null = null;
        if (storageConfigured()) {
          try {
            const up = await uploadImage(new File([new Uint8Array(buf)], `${p.sku}.webp`, { type: "image/webp" }), `products/${product.id}`);
            url = up.url; objectPath = up.path; res.imagesStored++;
          } catch (e) {
            res.errors.push(`${p.sku}: upload falhou (${e instanceof Error ? e.message : "erro"}); usando a foto empacotada`);
            res.imagesLinked++;
          }
        } else res.imagesLinked++;
        await db.productImage.create({ data: { productId: product.id, url, path: objectPath, alt: p.name, position: 0 } });
      }
    } catch (e) {
      res.errors.push(`${p.sku}: ${e instanceof Error ? e.message.split("\n").pop() : "erro"}`);
    }
  }
  const next = opts.offset + opts.limit;
  res.next = next < STARTER_TOTAL ? next : null;
  if (opts.userId !== undefined && res.next === null) await audit(opts.userId, "catalog.install", "Product", null, { created: res.created, skipped: res.skipped });
  return res;
}

export const isStarterSku = (sku: string) => sku.startsWith(STARTER_PREFIX);
