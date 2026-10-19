"use server";
import { revalidatePath } from "next/cache";
import { bustStore } from "@/lib/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordError, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { moveStock, StockError } from "@/lib/stock";
import { changeOrderStatus, OrderError } from "@/lib/orders";
import { deleteImage, uploadImage } from "@/lib/storage";
import { saveSettings, type StoreSettings } from "@/lib/settings";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const refresh = () => bustStore();

async function optionalUpload(fd: FormData, field: string, folder: string) {
  const f = fd.get(field);
  return f instanceof File && f.size > 0 ? uploadImage(f, folder) : null;
}

// ---------- categorias ----------
export async function saveCategory(fd: FormData) {
  const admin = await requireAdmin("categories.write");
  const id = String(fd.get("id") ?? "");
  const name = z.string().trim().min(2).max(80).safeParse(fd.get("name"));
  if (!name.success) go("/admin/categorias", "Nome inválido.", true);
  try {
    const up = await optionalUpload(fd, "image", "categories");
    const data = { name: name.data!, description: String(fd.get("description") ?? "") || null, position: Number(fd.get("position")) || 0, active: fd.get("active") === "on", ...(up ? { imageUrl: up.url } : {}) };
    if (id) { await db.category.update({ where: { id }, data }); await audit(admin.id, "category.update", "Category", id); }
    else { const c = await db.category.create({ data: { ...data, slug: slugify(name.data!) } }); await audit(admin.id, "category.create", "Category", c.id); }
  } catch (e) { go("/admin/categorias", e instanceof Error && e.message.includes("Unique") ? "Categoria já existe." : "Não foi possível salvar a categoria.", true); }
  refresh(); go("/admin/categorias", "Categoria salva.");
}

export async function deleteCategory(fd: FormData) {
  const admin = await requireAdmin("categories.write");
  const id = String(fd.get("id"));
  await db.category.delete({ where: { id } }); // produtos ficam sem categoria (SetNull)
  await audit(admin.id, "category.delete", "Category", id);
  refresh(); go("/admin/categorias", "Categoria excluída.");
}

// ---------- estoque ----------
export async function adjustStock(fd: FormData) {
  const admin = await requireAdmin("stock.write");
  const p = z.object({ variantId: z.string(), type: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]), quantity: z.coerce.number().int().min(0).max(100000), reason: z.string().trim().min(3).max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) go("/admin/estoque", "Informe quantidade e motivo (mín. 3 caracteres).", true);
  const { variantId, type, quantity, reason } = p.data!;
  try {
    await db.$transaction(async (tx) => {
      let delta = type === "ENTRY" ? quantity : type === "EXIT" ? -quantity : 0;
      if (type === "ADJUSTMENT") { const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId } }); delta = quantity - v.stock; } // quantidade final
      if (delta === 0) return;
      await moveStock(tx, { variantId, delta, type, reason, userId: admin.id });
      await audit(admin.id, "stock.adjust", "Variant", variantId, { type, delta, reason });
    });
  } catch (e) { go("/admin/estoque", e instanceof StockError ? "Saldo não pode ficar negativo." : "Falha ao ajustar estoque.", true); }
  refresh(); go("/admin/estoque", "Estoque atualizado.");
}

// ---------- pedidos ----------
export async function updateOrder(fd: FormData) {
  const admin = await requireAdmin("orders.write");
  const id = String(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  const note = String(fd.get("note") ?? "").slice(0, 300) || undefined;
  const tracking = String(fd.get("trackingCode") ?? "").trim().slice(0, 60);
  try {
    if (tracking !== String(fd.get("currentTracking") ?? "")) {
      await db.order.update({ where: { id }, data: { trackingCode: tracking || null } });
      await db.orderHistory.create({ data: { orderId: id, status: "TRACKING", note: tracking ? `Rastreio: ${tracking}` : "Rastreio removido", actor: admin.email } });
      await audit(admin.id, "order.tracking", "Order", id, { tracking });
    }
    if (status) {
      await changeOrderStatus(id, status, admin.email, note, admin.id);
      await audit(admin.id, "order.status", "Order", id, { status, note });
    }
  } catch (e) { go(`/admin/pedidos/${id}`, e instanceof OrderError ? e.message : "Falha ao atualizar.", true); }
  go(`/admin/pedidos/${id}`, "Pedido atualizado.");
}

// ---------- clientes ----------
export async function updateCustomer(fd: FormData) {
  const admin = await requireAdmin("customers.write");
  const id = String(fd.get("id"));
  const p = z.object({ name: z.string().trim().min(3).max(120), phone: z.string().trim().max(20).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) go(`/admin/clientes/${id}`, "Dados inválidos.", true);
  await db.customer.update({ where: { id }, data: { name: p.data!.name, phone: p.data!.phone || null } });
  await audit(admin.id, "customer.update", "Customer", id);
  go(`/admin/clientes/${id}`, "Cliente atualizado.");
}

/** Atende exclusão LGPD: anonimiza dados pessoais, preservando valores fiscais/financeiros dos pedidos. */
export async function resolvePrivacy(fd: FormData) {
  const admin = await requireAdmin("customers.write");
  const req = await db.privacyRequest.findUnique({ where: { id: String(fd.get("id")) } });
  if (!req) go("/admin/clientes", "Solicitação não encontrada.", true);
  if (req!.kind === "DELETE" && req!.customerId && fd.get("confirm") === "on") {
    const cid = req!.customerId;
    await db.$transaction([
      db.address.deleteMany({ where: { customerId: cid } }),
      db.passwordReset.deleteMany({ where: { customerId: cid } }),
      db.cart.deleteMany({ where: { customerId: cid } }),
      db.order.updateMany({ where: { customerId: cid }, data: { customerName: "Cliente anonimizado", email: `anon-${cid}@removido.invalid`, phone: null, shipStreet: "removido", shipNumber: "-", shipComplement: null, shipDistrict: "removido" } }),
      db.customer.update({ where: { id: cid }, data: { name: "Cliente anonimizado", email: `anon-${cid}@removido.invalid`, phone: null, cpf: null, passwordHash: null, anonymizedAt: new Date() } }),
    ]);
    await audit(admin.id, "privacy.anonymize", "Customer", cid);
  } else if (req!.kind === "DELETE") go("/admin/clientes", "Marque a confirmação para anonimizar a conta.", true);
  await db.privacyRequest.update({ where: { id: req!.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  await audit(admin.id, "privacy.resolve", "PrivacyRequest", req!.id, { kind: req!.kind });
  go("/admin/clientes", "Solicitação resolvida.");
}

// ---------- cupons ----------
export async function saveCoupon(fd: FormData) {
  const admin = await requireAdmin("coupons.write");
  const id = String(fd.get("id") ?? "");
  const type = fd.get("type") === "FIXED" ? "FIXED" : "PERCENT";
  const raw = String(fd.get("value") ?? "");
  const value = type === "PERCENT" ? Math.round(Number(raw.replace(",", "."))) : parseMoney(raw);
  const code = String(fd.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const int = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v ? Math.max(0, Math.floor(Number(v))) : null; };
  const date = (k: string) => { const v = String(fd.get(k) ?? ""); return v ? new Date(v) : null; };
  if (code.length < 3 || value == null || Number.isNaN(value) || value <= 0 || (type === "PERCENT" && value > 100)) go("/admin/cupons", "Código ou valor inválido.", true);
  const data = {
    code, type: type as "PERCENT" | "FIXED", value: value!, minOrderCents: parseMoney(String(fd.get("min") ?? "0")) ?? 0,
    startsAt: date("startsAt"), expiresAt: date("expiresAt"), maxUses: int("maxUses"), maxUsesPerCustomer: int("maxUsesPerCustomer"),
    productId: String(fd.get("productId") ?? "") || null, categoryId: String(fd.get("categoryId") ?? "") || null, active: fd.get("active") === "on",
  };
  try {
    const c = id ? await db.coupon.update({ where: { id }, data }) : await db.coupon.create({ data });
    await audit(admin.id, id ? "coupon.update" : "coupon.create", "Coupon", c.id, { code });
  } catch { go("/admin/cupons", "Código já existe ou dados inválidos.", true); }
  go("/admin/cupons", "Cupom salvo.");
}

export async function toggleCoupon(fd: FormData) {
  const admin = await requireAdmin("coupons.write");
  const id = String(fd.get("id"));
  const c = await db.coupon.findUniqueOrThrow({ where: { id } });
  await db.coupon.update({ where: { id }, data: { active: !c.active } });
  await audit(admin.id, "coupon.toggle", "Coupon", id, { active: !c.active });
  go("/admin/cupons", "Cupom atualizado.");
}

// ---------- banners ----------
const imageRef = z.string().max(600).refine((u) => u === "" || /^\/uploads\//.test(u) || /^https:\/\//.test(u), "Endereço de imagem inválido.");

const bannerSchema = z.object({
  title: z.string().trim().min(2, "Informe o título do banner.").max(120),
  subtitle: z.string().max(200).optional(),
  ctaLabel: z.string().max(40).optional(),
  link: z.string().max(300).optional(),
  placement: z.enum(["hero", "secondary"]),
  device: z.enum(["all", "desktop", "mobile"]),
  imageUrl: imageRef, imagePath: z.string().max(300).optional(),
  mobileImageUrl: imageRef.optional(), mobileImagePath: z.string().max(300).optional(),
});

export type BannerState = { ok: boolean; error?: string };

/** Cria ou atualiza um banner. As imagens já foram enviadas (com progresso) pelo formulário; aqui só gravamos as referências. */
export async function saveBannerAction(fd: FormData): Promise<BannerState> {
  const admin = await requireAdmin("content.write");
  const id = String(fd.get("id") ?? "");
  const p = bannerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Verifique os campos do banner." };
  const d = p.data;
  if (!d.imageUrl) return { ok: false, error: "Envie a imagem do banner antes de salvar." };
  if (d.link && !/^(\/|https:\/\/)/.test(d.link)) return { ok: false, error: "O link deve começar com / (página da loja) ou https://" };
  const data = {
    title: d.title, subtitle: d.subtitle || null, ctaLabel: d.ctaLabel || null, link: d.link || null, placement: d.placement, device: d.device,
    imageUrl: d.imageUrl, imagePath: d.imagePath || null, mobileImageUrl: d.mobileImageUrl || null, mobileImagePath: d.mobileImagePath || null,
    active: fd.get("active") === "on",
  };
  try {
    if (id) {
      const old = await db.banner.findUnique({ where: { id } });
      if (!old) return { ok: false, error: "Banner não encontrado." };
      await db.banner.update({ where: { id }, data });
      // apaga do armazenamento as imagens que foram substituídas
      if (old.imagePath && old.imagePath !== data.imagePath) await deleteImage(old.imagePath);
      if (old.mobileImagePath && old.mobileImagePath !== data.mobileImagePath) await deleteImage(old.mobileImagePath);
      await audit(admin.id, "banner.update", "Banner", id);
    } else {
      const last = await db.banner.aggregate({ where: { placement: d.placement }, _max: { position: true } });
      const b = await db.banner.create({ data: { ...data, position: (last._max.position ?? 0) + 1 } });
      await audit(admin.id, "banner.create", "Banner", b.id);
    }
  } catch (e) {
    console.error("saveBanner", e instanceof Error ? e.message : "erro");
    return { ok: false, error: "Não foi possível salvar o banner. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

export async function deleteBanner(fd: FormData) {
  const admin = await requireAdmin("content.write");
  const id = String(fd.get("id"));
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) go("/admin/banners", "Banner não encontrado.", true);
  await db.banner.delete({ where: { id } });
  await deleteImage(b!.imagePath); await deleteImage(b!.mobileImagePath);
  await audit(admin.id, "banner.delete", "Banner", id);
  refresh(); go("/admin/banners", "Banner excluído.");
}

export async function toggleBanner(fd: FormData) {
  const admin = await requireAdmin("content.write");
  const id = String(fd.get("id"));
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) go("/admin/banners", "Banner não encontrado.", true);
  await db.banner.update({ where: { id }, data: { active: !b!.active } });
  await audit(admin.id, "banner.toggle", "Banner", id, { active: !b!.active });
  refresh(); go("/admin/banners", b!.active ? "Banner desativado: não aparece mais na loja." : "Banner ativado: já aparece na loja.");
}

export async function moveBanner(fd: FormData) {
  const admin = await requireAdmin("content.write");
  const id = String(fd.get("id")); const dir = String(fd.get("dir")) === "up" ? -1 : 1;
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  const all = await db.banner.findMany({ where: { placement: b.placement }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const i = all.findIndex((x) => x.id === id); const j = i + dir;
  if (j < 0 || j >= all.length) return go("/admin/banners");
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.banner.update({ where: { id: x.id }, data: { position: k + 1 } })));
  await audit(admin.id, "banner.reorder", "Banner", id);
  refresh(); go("/admin/banners", "Ordem atualizada.");
}

// ---------- configurações ----------
export async function saveStoreSettings(fd: FormData) {
  const admin = await requireAdmin("settings.write");
  const s = (k: string, max = 2000) => String(fd.get(k) ?? "").slice(0, max);
  const accent = s("accent", 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) go("/admin/config", "Cor inválida (use #RRGGBB).", true);
  const patch: Partial<StoreSettings> = {
    name: s("name", 60) || "Loja", tagline: s("tagline", 100), accent, contactEmail: s("contactEmail", 120), contactPhone: s("contactPhone", 30), address: s("address", 200),
    instagram: s("instagram", 200), facebook: s("facebook", 200), tiktok: s("tiktok", 200), about: s("about"), privacyPolicy: s("privacyPolicy", 20000),
    termsPolicy: s("termsPolicy", 20000), exchangePolicy: s("exchangePolicy", 20000), seoTitle: s("seoTitle", 120), seoDescription: s("seoDescription", 300),
    promoBar: [s("promo1", 90), s("promo2", 90), s("promo3", 90)].filter(Boolean),
    homeSections: { featured: s("secFeatured", 40), news: s("secNews", 40), bestSellers: s("secBest", 40), sale: s("secSale", 40) },
    shipping: {
      freeAboveCents: parseMoney(s("freeAbove")) ?? 0,
      regions: Object.fromEntries((["SE", "S", "CO", "NE", "N"] as const).map((r) => [r, { priceCents: parseMoney(s(`ship_${r}`)) ?? 0, days: Math.max(1, Number(s(`days_${r}`)) || 5) }])) as StoreSettings["shipping"]["regions"],
    },
  };
  for (const k of ["instagram", "facebook", "tiktok"] as const) if (patch[k] && !/^https:\/\//.test(patch[k]!)) go("/admin/config", "Links de redes sociais devem começar com https://", true);
  try {
    const logo = await optionalUpload(fd, "logo", "brand"); if (logo) patch.logoUrl = logo.url;
    const fav = await optionalUpload(fd, "favicon", "brand"); if (fav) patch.faviconUrl = fav.url;
  } catch (e) { go("/admin/config", e instanceof Error ? e.message : "Falha no upload.", true); }
  await saveSettings(patch);
  await audit(admin.id, "settings.update", "Setting", null, { keys: Object.keys(patch) });
  refresh(); go("/admin/config", "Configurações salvas.");
}

// ---------- usuários e permissões ----------
export async function saveAdminUser(fd: FormData) {
  const admin = await requireAdmin("users.write");
  const id = String(fd.get("id") ?? "");
  const p = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email(), roleId: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) go("/admin/usuarios", "Dados inválidos.", true);
  const password = String(fd.get("password") ?? "");
  if (!id || password) { const e = passwordError(password); if (e) go("/admin/usuarios", e, true); }
  if (id === admin.id && fd.get("active") !== "on") go("/admin/usuarios", "Você não pode desativar a si mesmo.", true);
  try {
    const data = { ...p.data!, active: fd.get("active") === "on" || !id, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
    if (id) {
      await db.adminUser.update({ where: { id }, data });
      await audit(admin.id, "user.update", "AdminUser", id, { roleId: data.roleId, active: data.active });
    } else {
      const u = await db.adminUser.create({ data: { ...data, passwordHash: await hashPassword(password) } });
      await audit(admin.id, "user.create", "AdminUser", u.id, { roleId: data.roleId });
    }
  } catch { go("/admin/usuarios", "E-mail já cadastrado.", true); }
  go("/admin/usuarios", "Usuário salvo.");
}

export async function saveRole(fd: FormData) {
  const admin = await requireAdmin("users.write");
  const id = String(fd.get("id"));
  const role = await db.role.findUnique({ where: { id } });
  if (!role) go("/admin/usuarios", "Perfil não encontrado.", true);
  if (role!.name === "admin") go("/admin/usuarios", "O perfil de administrador principal não pode ser alterado.", true);
  const perms = fd.getAll("permissions").map(String).filter((x) => (ALL_PERMISSIONS as string[]).includes(x));
  await db.role.update({ where: { id }, data: { permissions: perms } });
  await audit(admin.id, "role.update", "Role", id, { permissions: perms });
  go("/admin/usuarios", "Permissões atualizadas.");
}
