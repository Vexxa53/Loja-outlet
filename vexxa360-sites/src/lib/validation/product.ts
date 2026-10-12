import { z } from "zod";
import { checkbox, intField, money, optionalMoney, optionalNumber, optionalText, optionalUuid, requiredText } from "./common";

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  size: z.string().trim().max(20).optional().transform((v) => v || undefined),
  color: z.string().trim().max(40).optional().transform((v) => v || undefined),
  sku: z.string().trim().max(60).optional().transform((v) => v || undefined),
  stock: z.number().int("Estoque deve ser inteiro.").min(0, "Estoque não pode ser negativo.").max(1_000_000),
  active: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof variantInput>;

export const productSchema = z
  .object({
    id: optionalUuid,
    name: requiredText("Nome", 1, 160),
    description: optionalText(5000),
    categoryId: optionalUuid,
    sku: optionalText(60),
    regularPrice: money("Preço de venda"),
    promotionalPrice: optionalMoney("Preço promocional"),
    costPrice: optionalMoney("Custo"),
    composition: optionalText(500),
    careInstructions: optionalText(1000),
    sizeGuide: optionalText(4000),
    weightGrams: z.preprocess((v) => (v === "" ? undefined : v), intField("Peso", 0, 200_000).optional()),
    lengthCm: optionalNumber("Comprimento"),
    widthCm: optionalNumber("Largura"),
    heightCm: optionalNumber("Altura"),
    tags: z.preprocess(
      (v) => (typeof v === "string" ? v.split(",").map((t) => t.trim()).filter(Boolean) : []),
      z.array(z.string().max(30, "Cada tag: máximo de 30 caracteres.")).max(20, "Máximo de 20 tags."),
    ),
    status: z.enum(["draft", "published"]),
    featured: checkbox,
    variants: z.preprocess(
      (v) => { try { return JSON.parse(String(v ?? "[]")); } catch { return null; } },
      z.array(variantInput).max(200, "Máximo de 200 variações."),
    ),
  })
  .superRefine((p, ctx) => {
    if (p.promotionalPrice !== undefined && p.promotionalPrice >= p.regularPrice) {
      ctx.addIssue({ code: "custom", path: ["promotionalPrice"], message: "O preço promocional deve ser menor que o preço de venda." });
    }
    const seen = new Set<string>();
    for (const v of p.variants) {
      const key = `${(v.size ?? "").toLowerCase()}|${(v.color ?? "").toLowerCase()}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["variants"], message: `Variação repetida: ${v.size ?? "—"} / ${v.color ?? "—"}.` });
      seen.add(key);
    }
    if (p.status === "published" && !p.variants.some((v) => v.active)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Para publicar, cadastre ao menos uma variação ativa (tamanho/cor com estoque)." });
    }
  });

export type ProductInput = z.infer<typeof productSchema>;
