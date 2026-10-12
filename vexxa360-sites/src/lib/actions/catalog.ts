"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "../supabase/server";
import { slugify } from "../slug";
import { MEDIA_BUCKET } from "../env";
import { MAX_IMAGE_BYTES, buildMediaPath, checkImage } from "../images";
import { fail, formToObject, success, zodFail, type ActionState } from "../validation/common";
import { bannerSchema, categorySchema, promotionSchema } from "../validation/store";
import { MANAGE, NOT_LOGGED, WRITE, dbMessage, flash } from "./helpers";
import { authorize, type TenantContext } from "../auth/context";
import { parseMoney } from "../money";

const refreshStore = (ctx: TenantContext) => revalidatePath(`/loja/${ctx.tenant.slug}`, "layout");

async function readImage(fd: FormData, field = "image"): Promise<{ bytes: Uint8Array; mime: string; ext: string } | { error: string } | null> {
  const f = fd.get(field);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_IMAGE_BYTES) return { error: "A imagem excede 4 MB." };
  const bytes = new Uint8Array(await f.arrayBuffer());
  const c = checkImage(bytes);
  return c.ok ? { bytes, mime: c.mime, ext: c.ext } : { error: c.error };
}

// ---------------------------------------------------------------- categorias
export async function saveCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(WRITE);
  if (!ctx) return fail(NOT_LOGGED);
  const parsed = categorySchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const c = parsed.data;
  const supabase = await createClient();

  const img = await readImage(fd);
  if (img && "error" in img) return fail(img.error);
  let imagePath: string | undefined;
  if (img) {
    imagePath = buildMediaPath(ctx.tenantId, "categories", img.ext);
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(imagePath, img.bytes, { contentType: img.mime });
    if (error) return fail("Falha ao enviar a imagem.");
  }
  const fields = { name: c.name, description: c.description ?? null, active: c.active, sort_order: c.sortOrder, ...(imagePath ? { image_path: imagePath } : {}) };

  if (c.id) {
    const { error } = await supabase.from("categories").update(fields).eq("id", c.id).eq("tenant_id", ctx.tenantId);
    if (error) return fail(dbMessage(error));
  } else {
    const base = slugify(c.name) || "categoria";
    let ok = false;
    for (let i = 0; i < 5 && !ok; i++) {
      const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
      const { error } = await supabase.from("categories").insert({ ...fields, tenant_id: ctx.tenantId, slug });
      if (!error) ok = true;
      else if (error.code !== "23505") return fail(dbMessage(error));
    }
    if (!ok) return fail("Já existe uma categoria com este nome.");
  }
  revalidatePath("/admin/categorias");
  refreshStore(ctx);
  return success(c.id ? "Categoria atualizada." : "Categoria criada.");
}

export async function deleteCategory(fd: FormData) {
  const ctx = await authorize(WRITE);
  if (!ctx) flash("/admin/categorias", "erro", NOT_LOGGED);
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", String(fd.get("id"))).eq("tenant_id", ctx!.tenantId);
  if (error) flash("/admin/categorias", "erro", dbMessage(error));
  refreshStore(ctx!);
  flash("/admin/categorias", "ok", "Categoria excluída. Os produtos dela ficaram sem categoria.");
}

// -------------------------------------------------------------------- estoque
export async function adjustStock(fd: FormData) {
  const ctx = await authorize(WRITE);
  if (!ctx) flash("/admin/estoque", "erro", NOT_LOGGED);
  const delta = Number(fd.get("delta"));
  const reason = String(fd.get("reason") ?? "").slice(0, 300);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) flash("/admin/estoque", "erro", "Informe uma quantidade inteira diferente de zero (use negativo para saída).");
  const supabase = await createClient();
  const variant = String(fd.get("variantId"));
  // a função do banco verifica que a variação pertence a uma loja do usuário
  const { error } = await supabase.rpc("adjust_stock", { p_variant: variant, p_delta: delta, p_type: "adjustment", p_reason: reason || (delta > 0 ? "Entrada manual" : "Saída manual") });
  if (error) flash("/admin/estoque", "erro", dbMessage(error));
  revalidatePath("/admin/estoque");
  refreshStore(ctx!);
  flash("/admin/estoque", "ok", "Estoque atualizado.");
}

// ------------------------------------------------------------------ promoções
export async function savePromotion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(MANAGE);
  if (!ctx) return fail(NOT_LOGGED);
  const parsed = promotionSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const p = parsed.data;
  const supabase = await createClient();
  if (p.productId) {
    const { data } = await supabase.from("products").select("id, regular_price").eq("id", p.productId).eq("tenant_id", ctx.tenantId).maybeSingle();
    if (!data) return fail("Produto não encontrado.");
    if (p.discountType === "fixed_price" && p.discountValue >= Number(data.regular_price)) return fail("O preço promocional deve ser menor que o preço de venda do produto.");
    if (p.discountType === "amount_off" && p.discountValue >= Number(data.regular_price)) return fail("O desconto deve ser menor que o preço do produto.");
  }
  const { error } = await supabase.from("promotions").insert({
    tenant_id: ctx.tenantId, name: p.name, product_id: p.productId ?? null, discount_type: p.discountType,
    discount_value: p.discountValue, starts_at: p.startsAt, ends_at: p.endsAt, active: p.active,
  });
  if (error) return fail(dbMessage(error));
  revalidatePath("/admin/promocoes");
  refreshStore(ctx);
  return success("Campanha criada. Ela entra e sai do ar automaticamente nas datas definidas.");
}

export async function togglePromotion(fd: FormData) {
  const ctx = await authorize(MANAGE);
  if (!ctx) flash("/admin/promocoes", "erro", NOT_LOGGED);
  const supabase = await createClient();
  const active = fd.get("active") === "1";
  const { error } = await supabase.from("promotions").update({ active }).eq("id", String(fd.get("id"))).eq("tenant_id", ctx!.tenantId);
  if (error) flash("/admin/promocoes", "erro", dbMessage(error));
  refreshStore(ctx!);
  flash("/admin/promocoes", "ok", active ? "Campanha ativada." : "Campanha pausada.");
}

export async function deletePromotion(fd: FormData) {
  const ctx = await authorize(MANAGE);
  if (!ctx) flash("/admin/promocoes", "erro", NOT_LOGGED);
  const supabase = await createClient();
  const { error } = await supabase.from("promotions").delete().eq("id", String(fd.get("id"))).eq("tenant_id", ctx!.tenantId);
  if (error) flash("/admin/promocoes", "erro", dbMessage(error));
  refreshStore(ctx!);
  flash("/admin/promocoes", "ok", "Campanha excluída. Pedidos já feitos mantêm o preço da época.");
}

/** Edição rápida de preços (preço de venda / promocional permanente). */
export async function updateProductPrices(fd: FormData) {
  const ctx = await authorize(MANAGE);
  if (!ctx) flash("/admin/promocoes", "erro", NOT_LOGGED);
  const regular = parseMoney(String(fd.get("regularPrice") ?? ""));
  const promoRaw = String(fd.get("promotionalPrice") ?? "").trim();
  const promo = promoRaw === "" ? null : parseMoney(promoRaw);
  if (Number.isNaN(regular) || regular < 0) flash("/admin/promocoes", "erro", "Preço de venda inválido. Use o formato 149,90.");
  if (promo !== null && (Number.isNaN(promo) || promo < 0 || promo >= regular)) flash("/admin/promocoes", "erro", "O preço promocional deve ser menor que o preço de venda.");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ regular_price: regular, promotional_price: promo }).eq("id", String(fd.get("id"))).eq("tenant_id", ctx!.tenantId);
  if (error) flash("/admin/promocoes", "erro", dbMessage(error));
  revalidatePath("/admin/produtos");
  refreshStore(ctx!);
  flash("/admin/promocoes", "ok", "Preços atualizados. Pedidos antigos não mudam.");
}

// -------------------------------------------------------------------- banners
export async function saveBanner(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(MANAGE);
  if (!ctx) return fail(NOT_LOGGED);
  const parsed = bannerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const b = parsed.data;
  const supabase = await createClient();

  const img = await readImage(fd);
  if (img && "error" in img) return fail(img.error);
  if (!img && !b.id) return fail("Envie a imagem do banner.");

  let imagePath: string | undefined;
  if (img && !("error" in img)) {
    imagePath = buildMediaPath(ctx.tenantId, "banners", img.ext);
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(imagePath, img.bytes, { contentType: img.mime });
    if (error) return fail("Falha ao enviar a imagem.");
  }
  const fields = {
    title: b.title, subtitle: b.subtitle ?? null, button_label: b.buttonLabel ?? null,
    destination_url: b.destinationUrl ?? null, active: b.active, sort_order: b.sortOrder,
    ...(imagePath ? { image_path: imagePath } : {}),
  };
  const { error } = b.id
    ? await supabase.from("banners").update(fields).eq("id", b.id).eq("tenant_id", ctx.tenantId)
    : await supabase.from("banners").insert({ ...fields, tenant_id: ctx.tenantId, image_path: imagePath! });
  if (error) return fail(dbMessage(error));
  revalidatePath("/admin/banners");
  refreshStore(ctx);
  return success(b.id ? "Banner atualizado." : "Banner criado.");
}

export async function deleteBanner(fd: FormData) {
  const ctx = await authorize(MANAGE);
  if (!ctx) flash("/admin/banners", "erro", NOT_LOGGED);
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: b } = await supabase.from("banners").select("image_path").eq("id", id).eq("tenant_id", ctx!.tenantId).maybeSingle();
  const { error } = await supabase.from("banners").delete().eq("id", id).eq("tenant_id", ctx!.tenantId);
  if (error) flash("/admin/banners", "erro", dbMessage(error));
  if (b?.image_path) await supabase.storage.from(MEDIA_BUCKET).remove([b.image_path]);
  refreshStore(ctx!);
  flash("/admin/banners", "ok", "Banner excluído.");
}
