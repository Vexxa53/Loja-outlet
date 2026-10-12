"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "../supabase/server";
import { slugify } from "../slug";
import { MEDIA_BUCKET } from "../env";
import { MAX_IMAGE_BYTES, buildMediaPath, checkImage } from "../images";
import { fail, formToObject, success, zodFail, type ActionState } from "../validation/common";
import { productSchema } from "../validation/product";
import { MANAGE, NOT_LOGGED, WRITE, dbMessage, flash } from "./helpers";
import { authorize, type TenantContext } from "../auth/context";

function revalidateStore(ctx: TenantContext) {
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  revalidatePath(`/loja/${ctx.tenant.slug}`, "layout");
}

/** Cria ou atualiza produto + variações (+ custo). Imagens são enviadas depois, uma a uma. */
export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);

  const parsed = productSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const p = parsed.data;
  const supabase = await createClient();

  const row = {
    category_id: p.categoryId ?? null,
    name: p.name,
    description: p.description ?? null,
    sku: p.sku ?? null,
    regular_price: p.regularPrice,
    promotional_price: p.promotionalPrice ?? null,
    status: p.status,
    featured: p.featured,
    composition: p.composition ?? null,
    care_instructions: p.careInstructions ?? null,
    size_guide: p.sizeGuide ?? null,
    weight_grams: p.weightGrams ?? null,
    length_cm: p.lengthCm ?? null,
    width_cm: p.widthCm ?? null,
    height_cm: p.heightCm ?? null,
    tags: p.tags,
  };

  let productId = p.id;
  if (productId) {
    // O produto precisa ser DESTA loja (o id vem do navegador e não é confiável).
    const { data: owned } = await supabase.from("products").select("id").eq("id", productId).eq("tenant_id", ctx.tenantId).maybeSingle();
    if (!owned) return fail("Produto não encontrado.");
    const { error } = await supabase.from("products").update(row).eq("id", productId).eq("tenant_id", ctx.tenantId);
    if (error) return fail(dbMessage(error));
  } else {
    const base = slugify(p.name) || "produto";
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt < 3 ? attempt + 1 : randomBytes(2).toString("hex")}`;
      const { data, error } = await supabase.from("products").insert({ ...row, tenant_id: ctx.tenantId, slug }).select("id").single();
      if (!error) { productId = data.id; break; }
      if (error.code !== "23505" || /sku/.test(error.message)) return fail(dbMessage(error));
    }
    if (!productId) return fail("Não foi possível gerar um endereço único para o produto.");
  }

  // ---- variações (tamanho × cor) ----
  const { data: existing } = await supabase.from("product_variants").select("id, stock_quantity").eq("product_id", productId).eq("tenant_id", ctx.tenantId);
  const existingMap = new Map((existing ?? []).map((v: any) => [v.id as string, v.stock_quantity as number]));
  const keep = new Set(p.variants.filter((v) => v.id && existingMap.has(v.id)).map((v) => v.id!));

  const removed = [...existingMap.keys()].filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await supabase.from("product_variants").delete().in("id", removed).eq("tenant_id", ctx.tenantId);
    if (error) return fail(dbMessage(error));
  }
  for (const v of p.variants) {
    if (v.id && existingMap.has(v.id)) {
      const { error } = await supabase.from("product_variants")
        .update({ size: v.size ?? null, color: v.color ?? null, sku: v.sku ?? null, active: v.active })
        .eq("id", v.id).eq("tenant_id", ctx.tenantId);
      if (error) return fail(dbMessage(error));
      if (existingMap.get(v.id) !== v.stock) {
        const { error: e2 } = await supabase.rpc("set_stock", { p_variant: v.id, p_quantity: v.stock, p_reason: "Ajuste no cadastro do produto" });
        if (e2) return fail(dbMessage(e2));
      }
    } else {
      const { error } = await supabase.from("product_variants").insert({
        tenant_id: ctx.tenantId, product_id: productId, size: v.size ?? null, color: v.color ?? null,
        sku: v.sku ?? null, stock_quantity: v.stock, active: v.active,
      });
      if (error) return fail(dbMessage(error));
    }
  }

  // ---- custo (visível só para dono/admin) ----
  if (MANAGE.includes(ctx.role)) {
    if (p.costPrice !== undefined) {
      const { error } = await supabase.from("product_costs").upsert({ product_id: productId, tenant_id: ctx.tenantId, cost_price: p.costPrice });
      if (error) return fail(dbMessage(error));
    } else {
      await supabase.from("product_costs").delete().eq("product_id", productId).eq("tenant_id", ctx.tenantId);
    }
  }

  revalidateStore(ctx);
  return success(p.status === "published" ? "Produto publicado." : "Rascunho salvo.", { productId });
}

async function ownedProduct(ctx: TenantContext, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle();
  return { supabase, product: data as any };
}

// ----------------------------------------------------------------- imagens
export async function uploadProductImage(productId: string, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const file = fd.get("file");
  if (!(file instanceof File)) return fail("Nenhum arquivo enviado.");
  if (file.size > MAX_IMAGE_BYTES) return fail("A imagem excede 4 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return fail(check.error);

  const { supabase, product } = await ownedProduct(ctx, productId);
  if (!product) return fail("Produto não encontrado.");

  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= 12) return fail("Máximo de 12 fotos por produto.");

  const path = buildMediaPath(ctx.tenantId, "products", check.ext, productId); // caminho definido no servidor
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: check.mime, upsert: false });
  if (upErr) return fail("Falha ao enviar a imagem. Tente novamente.");

  const alt = fd.get("alt")?.toString().slice(0, 200) || product.name;
  const { error } = await supabase.from("product_images").insert({
    tenant_id: ctx.tenantId, product_id: productId, storage_path: path, alt_text: alt,
    sort_order: count ?? 0, is_primary: (count ?? 0) === 0,
  });
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return fail(dbMessage(error, "Não foi possível registrar a imagem."));
  }
  revalidateStore(ctx);
  return success("Imagem enviada.");
}

export async function deleteProductImage(imageId: string): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const supabase = await createClient();
  const { data: img } = await supabase.from("product_images").select("*").eq("id", imageId).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!img) return fail("Imagem não encontrada.");
  const { error } = await supabase.from("product_images").delete().eq("id", imageId).eq("tenant_id", ctx.tenantId);
  if (error) return fail(dbMessage(error));
  await supabase.storage.from(MEDIA_BUCKET).remove([img.storage_path]);
  if (img.is_primary) {
    const { data: next } = await supabase.from("product_images").select("id").eq("product_id", img.product_id).order("sort_order").limit(1).maybeSingle();
    if (next) await supabase.from("product_images").update({ is_primary: true }).eq("id", next.id).eq("tenant_id", ctx.tenantId);
  }
  revalidateStore(ctx);
  return success("Imagem removida.");
}

export async function setPrimaryImage(imageId: string): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const supabase = await createClient();
  const { data: img } = await supabase.from("product_images").select("id, product_id").eq("id", imageId).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!img) return fail("Imagem não encontrada.");
  // índice único parcial: primeiro desmarca, depois marca
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", img.product_id).eq("tenant_id", ctx.tenantId);
  const { error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId).eq("tenant_id", ctx.tenantId);
  if (error) return fail(dbMessage(error));
  revalidateStore(ctx);
  return success("Imagem principal definida.");
}

export async function moveProductImage(imageId: string, direction: "up" | "down"): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const supabase = await createClient();
  const { data: img } = await supabase.from("product_images").select("id, product_id").eq("id", imageId).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!img) return fail("Imagem não encontrada.");
  const { data: all } = await supabase.from("product_images").select("id").eq("product_id", img.product_id).eq("tenant_id", ctx.tenantId).order("sort_order").order("created_at");
  const ids = (all ?? []).map((r: any) => r.id as string);
  const i = ids.indexOf(imageId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return success("Ok.");
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) {
    await supabase.from("product_images").update({ sort_order: k }).eq("id", ids[k]).eq("tenant_id", ctx.tenantId);
  }
  revalidateStore(ctx);
  return success("Ordem atualizada.");
}

export async function updateImageAlt(imageId: string, alt: string): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").update({ alt_text: alt.slice(0, 200) }).eq("id", imageId).eq("tenant_id", ctx.tenantId);
  return error ? fail(dbMessage(error)) : success("Texto alternativo salvo.");
}

// ------------------------------------------------------ ações de botão (lista)
const LIST = "/admin/produtos";

export async function setProductStatus(fd: FormData) {
  const ctx = await authorize(WRITE);
  if (!ctx) flash(LIST, "erro", NOT_LOGGED);
  const id = String(fd.get("id") ?? "");
  const status = fd.get("status") === "published" ? "published" : "draft";
  const { supabase, product } = await ownedProduct(ctx!, id);
  if (!product) flash(LIST, "erro", "Produto não encontrado.");
  if (status === "published") {
    const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", id).eq("active", true);
    if (!count) flash(LIST, "erro", "Cadastre ao menos uma variação ativa antes de publicar.");
  }
  const { error } = await supabase.from("products").update({ status, archived_at: null }).eq("id", id).eq("tenant_id", ctx!.tenantId);
  if (error) flash(LIST, "erro", dbMessage(error));
  revalidateStore(ctx!);
  flash(LIST, "ok", status === "published" ? "Produto publicado." : "Produto despublicado.");
}

export async function archiveProduct(fd: FormData) {
  const ctx = await authorize(WRITE);
  if (!ctx) flash(LIST, "erro", NOT_LOGGED);
  const id = String(fd.get("id") ?? "");
  const restore = fd.get("restore") === "1";
  const { supabase, product } = await ownedProduct(ctx!, id);
  if (!product) flash(LIST, "erro", "Produto não encontrado.");
  const { error } = await supabase.from("products")
    .update(restore ? { archived_at: null } : { archived_at: new Date().toISOString(), status: "draft", featured: false })
    .eq("id", id).eq("tenant_id", ctx!.tenantId);
  if (error) flash(LIST, "erro", dbMessage(error));
  revalidateStore(ctx!);
  flash(LIST, "ok", restore ? "Produto restaurado como rascunho." : "Produto arquivado.");
}

export async function deleteProduct(fd: FormData) {
  const ctx = await authorize(MANAGE);
  if (!ctx) flash(LIST, "erro", NOT_LOGGED);
  const id = String(fd.get("id") ?? "");
  const { supabase, product } = await ownedProduct(ctx!, id);
  if (!product) flash(LIST, "erro", "Produto não encontrado.");

  const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id).eq("tenant_id", ctx!.tenantId);
  if (count && count > 0) {
    // Tem histórico de vendas: arquiva em vez de excluir (o histórico já está em snapshot, mas preservamos o vínculo).
    await supabase.from("products").update({ archived_at: new Date().toISOString(), status: "draft", featured: false }).eq("id", id).eq("tenant_id", ctx!.tenantId);
    revalidateStore(ctx!);
    flash(LIST, "ok", "Este produto já tem pedidos, então foi arquivado em vez de excluído (o histórico de vendas é preservado).");
  }
  const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", id).eq("tenant_id", ctx!.tenantId);
  const { error } = await supabase.from("products").delete().eq("id", id).eq("tenant_id", ctx!.tenantId);
  if (error) flash(LIST, "erro", dbMessage(error));
  if (imgs?.length) await supabase.storage.from(MEDIA_BUCKET).remove(imgs.map((i: any) => i.storage_path));
  revalidateStore(ctx!);
  flash(LIST, "ok", "Produto excluído.");
}

export async function duplicateProduct(fd: FormData) {
  const ctx = await authorize(WRITE);
  if (!ctx) flash(LIST, "erro", NOT_LOGGED);
  const id = String(fd.get("id") ?? "");
  const { supabase, product } = await ownedProduct(ctx!, id);
  if (!product) flash(LIST, "erro", "Produto não encontrado.");

  const { id: _id, created_at: _c, updated_at: _u, archived_at: _a, slug: _s, sku: _k, ...rest } = product;
  const name = `${product.name} (cópia)`.slice(0, 160);
  const slug = `${slugify(product.name)}-copia-${randomBytes(2).toString("hex")}`.slice(0, 80);
  const { data: copy, error } = await supabase.from("products")
    .insert({ ...rest, name, slug, status: "draft", featured: false, tenant_id: ctx!.tenantId }).select("id").single();
  if (error || !copy) flash(LIST, "erro", dbMessage(error));

  const { data: variants } = await supabase.from("product_variants").select("size, color, active").eq("product_id", id).eq("tenant_id", ctx!.tenantId);
  if (variants?.length) {
    // cópia nasce com estoque zerado e sem SKU (SKU é único)
    await supabase.from("product_variants").insert(variants.map((v: any) => ({ tenant_id: ctx!.tenantId, product_id: copy!.id, size: v.size, color: v.color, active: v.active, stock_quantity: 0 })));
  }
  const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", id).eq("tenant_id", ctx!.tenantId).order("sort_order");
  for (const img of imgs ?? []) {
    const ext = String(img.storage_path).split(".").pop() ?? "jpg";
    const dest = buildMediaPath(ctx!.tenantId, "products", ext, copy!.id);
    const { error: cpErr } = await supabase.storage.from(MEDIA_BUCKET).copy(img.storage_path, dest);
    if (!cpErr) {
      await supabase.from("product_images").insert({ tenant_id: ctx!.tenantId, product_id: copy!.id, storage_path: dest, alt_text: img.alt_text, sort_order: img.sort_order, is_primary: img.is_primary });
    }
  }
  revalidateStore(ctx!);
  redirect_to_edit(copy!.id);
}

function redirect_to_edit(id: string): never {
  redirect(`/admin/produtos/${id}?ok=${encodeURIComponent("Produto duplicado como rascunho. Ajuste o estoque e publique quando estiver pronto.")}`);
}
