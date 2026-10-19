"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { bustStore } from "@/lib/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { deleteImage } from "@/lib/storage";
import { installStarterBatch, type BatchResult } from "@/lib/starter-catalog";
import { STARTER_PREFIX } from "@/catalog/starter-catalog";

/** Instala o catálogo inicial em fatias (o painel chama em sequência, com barra de progresso). */
export async function installStarterCatalogBatch(offset: number): Promise<BatchResult> {
  const admin = await requireAdmin("products.write");
  await requireAdmin("categories.write");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : undefined;
  const r = await installStarterBatch({ offset: Math.max(0, Math.floor(offset)), limit: 6, origin, userId: admin.id });
  bustStore();
  return r;
}

/** Muda a situação de TODOS os produtos do catálogo inicial (ex.: colocar como Inativos antes de abrir a loja). */
export async function setStarterStatus(fd: FormData) {
  const admin = await requireAdmin("products.write");
  const status = String(fd.get("status"));
  if (!["DRAFT", "UNAVAILABLE", "PUBLISHED"].includes(status)) go("/admin/produtos", "Situação inválida.", true);
  const r = await db.product.updateMany({ where: { sku: { startsWith: STARTER_PREFIX } }, data: { status: status as never } });
  await audit(admin.id, "catalog.status", "Product", null, { status, count: r.count });
  bustStore();
  go("/admin/produtos", `${r.count} produto(s) do catálogo inicial atualizados.`);
}

/** Remove o catálogo inicial. Produtos que já tiveram pedidos são arquivados para preservar o histórico. */
export async function removeStarterCatalog() {
  const admin = await requireAdmin("products.write");
  const products = await db.product.findMany({ where: { sku: { startsWith: STARTER_PREFIX } }, select: { id: true, images: { select: { path: true } } } });
  let removed = 0, archived = 0;
  for (const p of products) {
    if ((await db.orderItem.count({ where: { productId: p.id } })) > 0) {
      await db.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
      archived++;
    } else {
      await db.product.delete({ where: { id: p.id } });
      await Promise.all(p.images.map((i) => deleteImage(i.path)));
      removed++;
    }
  }
  await audit(admin.id, "catalog.remove", "Product", null, { removed, archived });
  bustStore();
  go("/admin/produtos", `Catálogo inicial removido: ${removed} excluído(s)${archived ? `, ${archived} arquivado(s) por já terem pedidos` : ""}.`);
}
