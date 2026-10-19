"use server";
import { revalidatePath } from "next/cache";
import { bustStore } from "@/lib/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { moveStock } from "@/lib/stock";
import { deleteImage } from "@/lib/storage";

const STATUSES = ["PUBLISHED", "DRAFT", "UNAVAILABLE", "ARCHIVED"] as const;

const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(160),
  description: z.string().max(5000).default(""),
  sku: z.string().trim().min(2, "Informe o código (SKU) do produto.").max(40).toUpperCase(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  status: z.enum(STATUSES),
  weightGrams: z.coerce.number().int().min(1).max(50000),
  lengthCm: z.coerce.number().int().min(1).max(200),
  widthCm: z.coerce.number().int().min(1).max(200),
  heightCm: z.coerce.number().int().min(1).max(200),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
});

const initialVariants = z.array(z.object({
  size: z.string().trim().min(1).max(12),
  color: z.string().trim().min(1).max(30),
  stock: z.coerce.number().int().min(0).max(100000),
})).max(60);

async function uniqueSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || "produto";
  let slug = root;
  for (let i = 2; await db.product.findFirst({ where: { slug, id: ignoreId ? { not: ignoreId } : undefined } }); i++) slug = `${root}-${i}`;
  return slug;
}

export type SaveState = { ok: boolean; error?: string; id?: string; created?: boolean };

/**
 * Cria ou atualiza um produto. Devolve um resultado (sem redirecionar) para o formulário
 * poder enviar as imagens logo em seguida. Toda a validação acontece aqui, no servidor.
 */
export async function saveProductAction(fd: FormData): Promise<SaveState> {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id") ?? "");
  const parsed = productSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Verifique os campos do produto." };
  const price = parseMoney(String(fd.get("price") ?? ""));
  if (price == null || price <= 0) return { ok: false, error: "Informe um preço de venda válido (ex.: 129,90)." };
  const cost = parseMoney(String(fd.get("cost") ?? "0")) ?? 0;
  const promoRaw = String(fd.get("promo") ?? "").trim();
  const promo = promoRaw ? parseMoney(promoRaw) : null;
  if (promoRaw && (promo == null || promo >= price)) return { ok: false, error: "O preço promocional precisa ser menor que o preço de venda." };

  let variants: z.infer<typeof initialVariants> = [];
  const rawVariants = String(fd.get("variants") ?? "");
  if (!id && rawVariants) {
    const v = initialVariants.safeParse(JSON.parse(rawVariants || "[]"));
    if (!v.success) return { ok: false, error: "Verifique tamanho, cor e estoque das variações." };
    variants = v.data;
  }
  const d = parsed.data;
  if ((d.status === "PUBLISHED" || d.status === "UNAVAILABLE") && !id && variants.length === 0)
    return { ok: false, error: "Para publicar, informe ao menos uma variação (tamanho, cor e estoque). Ou salve como Inativo e complete depois." };
  if ((d.status === "PUBLISHED" || d.status === "UNAVAILABLE") && id && (await db.variant.count({ where: { productId: id } })) === 0)
    return { ok: false, error: "Cadastre ao menos uma variação antes de publicar." };

  const data = {
    name: d.name, description: d.description, sku: d.sku, brand: d.brand || null, categoryId: d.categoryId || null, status: d.status,
    weightGrams: d.weightGrams, lengthCm: d.lengthCm, widthCm: d.widthCm, heightCm: d.heightCm,
    seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null,
    costCents: cost, priceCents: price, promoPriceCents: promo,
    featured: fd.get("featured") === "on", isNew: fd.get("isNew") === "on",
  };
  try {
    if (id) {
      const before = await db.product.findUnique({ where: { id } });
      if (!before) return { ok: false, error: "Produto não encontrado." };
      // o endereço (slug) permanece o mesmo ao renomear: links já compartilhados e o Google continuam funcionando
      await db.product.update({ where: { id }, data });
      const priceChanged = before.priceCents !== data.priceCents || before.promoPriceCents !== data.promoPriceCents || before.costCents !== data.costCents;
      await audit(admin.id, priceChanged ? "product.update+price" : "product.update", "Product", id, {
        ...(priceChanged ? { price: [before.priceCents, data.priceCents], promo: [before.promoPriceCents, data.promoPriceCents], cost: [before.costCents, data.costCents] } : {}),
        ...(before.status !== data.status ? { status: [before.status, data.status] } : {}),
      });
      bustStore();
      return { ok: true, id, created: false };
    }
    const created = await db.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...data, slug: await uniqueSlug(data.name) } });
      for (const v of variants) {
        const vsku = `${data.sku}-${slugify(v.size)}-${slugify(v.color)}`.toUpperCase();
        const row = await tx.variant.create({ data: { productId: p.id, sku: vsku, size: v.size.toUpperCase(), color: v.color, stock: 0 } });
        if (v.stock > 0) await moveStock(tx, { variantId: row.id, delta: v.stock, type: "ENTRY", reason: "Estoque inicial", userId: admin.id });
      }
      return p;
    });
    await audit(admin.id, "product.create", "Product", created.id, { sku: created.sku, variants: variants.length });
    bustStore();
    return { ok: true, id: created.id, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique")) return { ok: false, error: "Já existe um produto (ou variação) com esse código SKU, ou tamanho/cor repetidos." };
    console.error("saveProduct", msg);
    return { ok: false, error: "Não foi possível salvar o produto. Tente novamente." };
  }
}

export async function duplicateProduct(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const src = await db.product.findUnique({ where: { id: String(fd.get("id")) }, include: { variants: true } });
  if (!src) go("/admin/produtos", "Produto não encontrado.", true);
  const n = Date.now().toString(36).toUpperCase().slice(-4);
  const copy = await db.product.create({
    data: {
      name: `${src!.name} (cópia)`, slug: await uniqueSlug(`${src!.name} copia`), description: src!.description, sku: `${src!.sku}-C${n}`, brand: src!.brand,
      categoryId: src!.categoryId, costCents: src!.costCents, priceCents: src!.priceCents, promoPriceCents: src!.promoPriceCents, weightGrams: src!.weightGrams,
      lengthCm: src!.lengthCm, widthCm: src!.widthCm, heightCm: src!.heightCm, status: "DRAFT",
      variants: { create: src!.variants.map((v) => ({ sku: `${v.sku}-C${n}`, size: v.size, color: v.color, stock: 0, minStock: v.minStock })) },
    },
  });
  await audit(admin.id, "product.duplicate", "Product", copy.id, { from: src!.id });
  go(`/admin/produtos/${copy.id}`, "Produto duplicado como Inativo (estoque zerado e sem imagens).");
}

export async function deleteProduct(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id"));
  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(admin.id, "product.archive(instead-of-delete)", "Product", id);
    bustStore();
    go("/admin/produtos", "Este produto já foi vendido, então foi arquivado (some da loja) para preservar o histórico dos pedidos.");
  }
  const imgs = await db.productImage.findMany({ where: { productId: id } });
  await db.product.delete({ where: { id } });
  await Promise.all(imgs.map((i) => deleteImage(i.path)));
  await audit(admin.id, "product.delete", "Product", id);
  bustStore();
  go("/admin/produtos", "Produto excluído.");
}

const variantSchema = z.object({
  productId: z.string(), size: z.string().trim().min(1).max(12).toUpperCase(), color: z.string().trim().min(1).max(30),
  sku: z.string().trim().min(2).max(60).toUpperCase(), stock: z.coerce.number().int().min(0).max(100000), minStock: z.coerce.number().int().min(0).max(10000),
});

export async function addVariant(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const v = variantSchema.safeParse(Object.fromEntries(fd));
  const pid = String(fd.get("productId"));
  if (!v.success) go(`/admin/produtos/${pid}`, "Dados da variação inválidos.", true);
  try {
    await db.$transaction(async (tx) => {
      const { stock, ...rest } = v.data!;
      const created = await tx.variant.create({ data: { ...rest, stock: 0 } });
      if (stock > 0) await moveStock(tx, { variantId: created.id, delta: stock, type: "ENTRY", reason: "Estoque inicial", userId: admin.id });
      await audit(admin.id, "variant.create", "Variant", created.id, { sku: created.sku, stock });
    });
  } catch { go(`/admin/produtos/${pid}`, "Variação duplicada (tamanho/cor ou SKU já existe).", true); }
  bustStore();
  go(`/admin/produtos/${pid}`, "Variação adicionada.");
}

export async function updateVariant(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id")); const pid = String(fd.get("productId"));
  await db.variant.update({ where: { id }, data: { minStock: Math.max(0, Number(fd.get("minStock")) || 0), active: fd.get("active") === "on" } });
  await audit(admin.id, "variant.update", "Variant", id);
  bustStore();
  go(`/admin/produtos/${pid}`, "Variação atualizada.");
}

export async function deleteVariant(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id")); const pid = String(fd.get("productId"));
  await db.variant.delete({ where: { id } });
  await audit(admin.id, "variant.delete", "Variant", id);
  bustStore();
  go(`/admin/produtos/${pid}`, "Variação removida (pedidos antigos preservam o histórico).");
}

export async function moveImage(fd: FormData) {
  await requireAdmin("products.write");
  const id = String(fd.get("id")); const dir = String(fd.get("dir")) === "up" ? -1 : 1;
  const img = await db.productImage.findUnique({ where: { id } });
  if (!img) return;
  const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { position: "asc" } });
  const i = all.findIndex((x) => x.id === id); const j = i + dir;
  if (j < 0 || j >= all.length) return go(`/admin/produtos/${img.productId}`);
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.productImage.update({ where: { id: x.id }, data: { position: k } })));
  bustStore();
  go(`/admin/produtos/${img.productId}`, "Ordem das imagens atualizada.");
}

export async function removeImage(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const img = await db.productImage.findUnique({ where: { id: String(fd.get("id")) } });
  if (!img) return;
  await db.productImage.delete({ where: { id: img.id } });
  await deleteImage(img.path);
  await audit(admin.id, "product.image.delete", "Product", img.productId);
  bustStore();
  go(`/admin/produtos/${img.productId}`, "Imagem removida.");
}
