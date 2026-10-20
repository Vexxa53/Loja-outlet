"use server";
import { bustStore } from "@/lib/cache";
import { persistProduct, uniqueSlug, type SaveState, type VariantPayload } from "@/lib/product-save";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { slugify } from "@/lib/slug";
import { deleteImage } from "@/lib/storage";

export type { SaveState } from "@/lib/product-save";

/** Lê o formulário e delega ao serviço (lib/product-save.ts), que valida tudo no servidor e grava numa transação. */
export async function saveProductAction(fd: FormData): Promise<SaveState> {
  const admin = await requireAdmin("products.write");
  const fields: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && k !== "variants") fields[k] = v;
  let variants: VariantPayload[] | undefined;
  const raw = fd.get("variants");
  if (typeof raw === "string" && raw !== "") {
    try { const j = JSON.parse(raw); if (!Array.isArray(j) || j.length > 400) throw new Error("x"); variants = j as VariantPayload[]; }
    catch { return { ok: false, error: "Não foi possível ler as variações enviadas. Recarregue a página e tente novamente." }; }
  }
  return persistProduct(
    { id: admin.id, permissions: admin.role.permissions },
    { id: String(fd.get("id") ?? "") || undefined, fields, featured: fd.get("featured") === "on", isNew: fd.get("isNew") === "on", variants },
  );
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
