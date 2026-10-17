"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { moveStock } from "@/lib/stock";
import { deleteImage, uploadImage } from "@/lib/storage";

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().max(5000).default(""),
  sku: z.string().trim().min(2).max(40).toUpperCase(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  weightGrams: z.coerce.number().int().min(1).max(50000),
  lengthCm: z.coerce.number().int().min(1).max(200),
  widthCm: z.coerce.number().int().min(1).max(200),
  heightCm: z.coerce.number().int().min(1).max(200),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
});

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = slugify(base) || "produto";
  for (let i = 2; await db.product.findFirst({ where: { slug, id: ignoreId ? { not: ignoreId } : undefined } }); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}

export async function saveProduct(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id") ?? "");
  const p = productSchema.safeParse(Object.fromEntries(fd));
  const cost = parseMoney(String(fd.get("cost") ?? "0")) ?? 0;
  const price = parseMoney(String(fd.get("price") ?? ""));
  const promoRaw = String(fd.get("promo") ?? "").trim();
  const promo = promoRaw ? parseMoney(promoRaw) : null;
  const back = id ? `/admin/produtos/${id}` : "/admin/produtos/novo";
  if (!p.success || price == null || price <= 0) go(back, "Verifique os campos obrigatórios e o preço.", true);
  if (promoRaw && (promo == null || promo >= price!)) go(back, "O preço promocional deve ser menor que o preço de venda.", true);
  const data = {
    ...p.data!, brand: p.data!.brand || null, categoryId: p.data!.categoryId || null, seoTitle: p.data!.seoTitle || null, seoDescription: p.data!.seoDescription || null,
    costCents: cost, priceCents: price!, promoPriceCents: promo,
    featured: fd.get("featured") === "on", isNew: fd.get("isNew") === "on",
  };
  try {
    if (id) {
      const before = await db.product.findUnique({ where: { id } });
      if (!before) go("/admin/produtos", "Produto não encontrado.", true);
      const slug = before!.name === data.name ? before!.slug : await uniqueSlug(data.name, id);
      await db.product.update({ where: { id }, data: { ...data, slug } });
      const priceChanged = before!.priceCents !== data.priceCents || before!.promoPriceCents !== data.promoPriceCents || before!.costCents !== data.costCents;
      await audit(admin.id, priceChanged ? "product.update+price" : "product.update", "Product", id,
        priceChanged ? { price: [before!.priceCents, data.priceCents], promo: [before!.promoPriceCents, data.promoPriceCents], cost: [before!.costCents, data.costCents] } : undefined);
    } else {
      const created = await db.product.create({ data: { ...data, slug: await uniqueSlug(data.name) } });
      await audit(admin.id, "product.create", "Product", created.id, { sku: created.sku });
      go(`/admin/produtos/${created.id}`, "Produto criado como rascunho. Adicione variações e imagens.");
    }
  } catch (e) {
    if (typeof e === "object" && e && "digest" in e) throw e;
    go(back, "Não foi possível salvar (SKU duplicado?).", true);
  }
  revalidatePath("/", "layout");
  go(`/admin/produtos/${id}`, "Produto salvo.");
}

export async function setProductStatus(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) go("/admin/produtos", "Status inválido.", true);
  if (status === "PUBLISHED") {
    const p = await db.product.findUnique({ where: { id }, include: { variants: true, images: true } });
    if (!p || !p.variants.length) go(`/admin/produtos/${id}`, "Cadastre ao menos uma variação antes de publicar.", true);
  }
  await db.product.update({ where: { id }, data: { status: status as never } });
  await audit(admin.id, `product.${status.toLowerCase()}`, "Product", id);
  revalidatePath("/", "layout");
  go(`/admin/produtos/${id}`, "Status atualizado.");
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
  go(`/admin/produtos/${copy.id}`, "Produto duplicado (rascunho, estoque zerado, sem imagens).");
}

export async function deleteProduct(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id"));
  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(admin.id, "product.archive(instead-of-delete)", "Product", id);
    go("/admin/produtos", "Produto com vendas: arquivado para preservar o histórico.");
  }
  const imgs = await db.productImage.findMany({ where: { productId: id } });
  await db.product.delete({ where: { id } });
  await Promise.all(imgs.map((i) => deleteImage(i.path)));
  await audit(admin.id, "product.delete", "Product", id);
  revalidatePath("/", "layout");
  go("/admin/produtos", "Produto excluído.");
}

const variantSchema = z.object({
  productId: z.string(), size: z.string().trim().min(1).max(10).toUpperCase(), color: z.string().trim().min(1).max(30),
  sku: z.string().trim().min(2).max(50).toUpperCase(), stock: z.coerce.number().int().min(0).max(100000), minStock: z.coerce.number().int().min(0).max(10000),
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
  revalidatePath("/", "layout");
  go(`/admin/produtos/${pid}`, "Variação adicionada.");
}

export async function updateVariant(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id")); const pid = String(fd.get("productId"));
  await db.variant.update({ where: { id }, data: { minStock: Math.max(0, Number(fd.get("minStock")) || 0), active: fd.get("active") === "on" } });
  await audit(admin.id, "variant.update", "Variant", id);
  revalidatePath("/", "layout");
  go(`/admin/produtos/${pid}`, "Variação atualizada.");
}

export async function deleteVariant(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const id = String(fd.get("id")); const pid = String(fd.get("productId"));
  await db.variant.delete({ where: { id } });
  await audit(admin.id, "variant.delete", "Variant", id);
  revalidatePath("/", "layout");
  go(`/admin/produtos/${pid}`, "Variação removida (pedidos antigos preservam o snapshot).");
}

export async function uploadProductImages(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const pid = String(fd.get("productId"));
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) go(`/admin/produtos/${pid}`, "Selecione ao menos uma imagem.", true);
  const last = await db.productImage.aggregate({ where: { productId: pid }, _max: { position: true } });
  let pos = (last._max.position ?? -1) + 1;
  try {
    for (const f of files.slice(0, 8)) {
      const up = await uploadImage(f, `products/${pid}`);
      await db.productImage.create({ data: { productId: pid, url: up.url, path: up.path, position: pos++, alt: String(fd.get("alt") ?? "") || null } });
    }
  } catch (e) { go(`/admin/produtos/${pid}`, e instanceof Error ? e.message : "Falha no upload.", true); }
  await audit(admin.id, "product.images.upload", "Product", pid, { count: files.length });
  revalidatePath("/", "layout");
  go(`/admin/produtos/${pid}`, "Imagens enviadas.");
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
  revalidatePath("/", "layout");
  go(`/admin/produtos/${img.productId}`);
}

export async function removeImage(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const img = await db.productImage.findUnique({ where: { id: String(fd.get("id")) } });
  if (!img) return;
  await db.productImage.delete({ where: { id: img.id } });
  await deleteImage(img.path);
  await audit(admin.id, "product.image.delete", "Product", img.productId);
  revalidatePath("/", "layout");
  go(`/admin/produtos/${img.productId}`, "Imagem removida.");
}
