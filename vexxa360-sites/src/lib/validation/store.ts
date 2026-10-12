import { z } from "zod";
import { brLocalToIso, checkbox, hexColor, httpsUrl, intField, money, optionalText, optionalUuid, phoneBr, requiredText } from "./common";

export const categorySchema = z.object({
  id: optionalUuid,
  name: requiredText("Nome", 1, 80),
  description: optionalText(500),
  active: checkbox,
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), intField("Ordem", 0, 10_000)),
});

export const promotionSchema = z
  .object({
    name: requiredText("Nome da campanha", 1, 120),
    productId: optionalUuid,
    discountType: z.enum(["percent", "amount_off", "fixed_price"], { error: "Tipo de desconto inválido." }),
    discountValue: money("Valor do desconto"),
    startsAt: z.string().transform((v, ctx) => {
      const iso = brLocalToIso(v);
      if (!iso) { ctx.addIssue({ code: "custom", message: "Data de início inválida." }); return z.NEVER; }
      return iso;
    }),
    endsAt: z.string().transform((v, ctx) => {
      const iso = brLocalToIso(v);
      if (!iso) { ctx.addIssue({ code: "custom", message: "Data de encerramento inválida." }); return z.NEVER; }
      return iso;
    }),
    active: checkbox,
  })
  .superRefine((p, ctx) => {
    if (p.discountValue <= 0) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "O desconto deve ser maior que zero." });
    if (p.discountType === "percent" && p.discountValue > 90) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Desconto percentual máximo: 90%." });
    if (p.discountType === "fixed_price" && !p.productId) ctx.addIssue({ code: "custom", path: ["productId"], message: "Preço fixo exige escolher um produto." });
    if (new Date(p.endsAt) <= new Date(p.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O encerramento deve ser depois do início." });
  });

export const bannerSchema = z.object({
  id: optionalUuid,
  title: requiredText("Título", 1, 120),
  subtitle: optionalText(240),
  buttonLabel: optionalText(40),
  destinationUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(500).refine((u) => (u.startsWith("/") && !u.startsWith("//")) || /^https:\/\//.test(u), "Destino: use um caminho (/loja/...) ou um link https://").optional(),
  ),
  active: checkbox,
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), intField("Ordem", 0, 10_000)),
});

const instagram = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") || undefined : v),
  z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Instagram inválido (apenas o @usuario).").optional(),
);

/** Personalização visual */
export const brandingSchema = z.object({
  storeName: requiredText("Nome da loja", 2, 120),
  description: optionalText(1000),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  instagram,
});

/** Configurações operacionais */
export const settingsSchema = z.object({
  whatsapp: phoneBr("WhatsApp"),
  contactEmail: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.email("E-mail inválido.").max(200).optional()),
  address: optionalText(300),
  businessHours: optionalText(300),
  shippingInfo: optionalText(1000),
  privacyUrl: httpsUrl("Política de privacidade"),
  termsUrl: httpsUrl("Termos"),
  exchangeUrl: httpsUrl("Trocas e devoluções"),
  sizeGuide: optionalText(4000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(200),
  lowStockThreshold: intField("Limite de estoque baixo", 0, 1000),
  reservationHours: intField("Prazo de reserva", 1, 720),
  published: checkbox,
});

export const checkoutSchema = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  phone: phoneBr("Telefone"),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.email("E-mail inválido.").max(200).optional()),
  notes: optionalText(300),
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1, "Sua sacola está vazia.")
    .max(40, "Máximo de 40 itens por pedido."),
});

export const tenantSchema = z.object({
  name: requiredText("Nome da loja", 2, 120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Identificador: apenas letras minúsculas, números e hífens.").min(2).max(60),
  ownerEmail: z.email("E-mail do lojista inválido."),
});
