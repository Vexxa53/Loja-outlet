"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { MEDIA_BUCKET } from "../env";
import { MAX_IMAGE_BYTES, buildMediaPath, checkImage } from "../images";
import { fail, formToObject, success, zodFail, type ActionState } from "../validation/common";
import { brandingSchema, settingsSchema } from "../validation/store";
import { MANAGE, NOT_LOGGED, dbMessage } from "./helpers";
import { authorize } from "../auth/context";

async function update(ctx: { tenantId: string; tenant: { slug: string } }, fields: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").update(fields).eq("tenant_id", ctx.tenantId).select("id");
  if (error) return fail(dbMessage(error));
  if (!data?.length) return fail("Você não tem permissão para alterar esta loja.");
  revalidatePath("/admin", "layout");
  revalidatePath(`/loja/${ctx.tenant.slug}`, "layout");
  return null;
}

export async function saveBranding(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(MANAGE);
  if (!ctx) return fail(NOT_LOGGED);
  const parsed = brandingSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const b = parsed.data;

  const fields: Record<string, unknown> = {
    store_name: b.storeName, description: b.description ?? null,
    primary_color: b.primaryColor.toLowerCase(), secondary_color: b.secondaryColor.toLowerCase(),
    instagram: b.instagram ?? null,
  };

  const logo = fd.get("logo");
  const supabase = await createClient();
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_IMAGE_BYTES) return fail("O logotipo excede 4 MB.");
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const c = checkImage(bytes);
    if (!c.ok) return fail(c.error);
    const path = buildMediaPath(ctx.tenantId, "branding", c.ext);
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: c.mime });
    if (error) return fail("Falha ao enviar o logotipo.");
    fields.logo_path = path;
  } else if (fd.get("removeLogo") === "on") {
    fields.logo_path = null;
  }
  const err = await update(ctx, fields);
  return err ?? success("Personalização salva. A loja pública já reflete as mudanças.");
}

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await authorize(MANAGE);
  if (!ctx) return fail(NOT_LOGGED);
  const parsed = settingsSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const s = parsed.data;
  const err = await update(ctx, {
    whatsapp: s.whatsapp, contact_email: s.contactEmail ?? null, address: s.address ?? null,
    business_hours: s.businessHours ?? null, shipping_info: s.shippingInfo ?? null,
    privacy_url: s.privacyUrl ?? null, terms_url: s.termsUrl ?? null, exchange_url: s.exchangeUrl ?? null,
    size_guide: s.sizeGuide ?? null, seo_title: s.seoTitle ?? null, seo_description: s.seoDescription ?? null,
    low_stock_threshold: s.lowStockThreshold, reservation_hours: s.reservationHours, published: s.published,
  });
  return err ?? success(s.published ? "Configurações salvas. A loja está publicada." : "Configurações salvas. A loja está oculta do público.");
}
