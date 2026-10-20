import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { bustStore } from "./cache";
import { parseMoney } from "./money";
import { slugify } from "./slug";
import { moveStock } from "./stock";
import { loadGridConfig } from "./size-grid-config";
import { kindFor, KIND_RULES, makeSku, normalizeColor, normalizeSize, variantKey } from "./size-grids";
import { validateVariants, type CleanRow, type VariantInput } from "./variant-rules";

export type Actor = { id: string | null; permissions: readonly string[] };
export type SaveState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; id?: string; created?: boolean };
export type VariantPayload = VariantInput;
export type ProductInput = {
  id?: string;
  fields: Record<string, string>;     // texto como veio do formulário
  featured: boolean; isNew: boolean;
  variants?: VariantPayload[];        // undefined = não mexer nas variações
};

const STATUSES = ["PUBLISHED", "DRAFT", "UNAVAILABLE", "ARCHIVED"] as const;
const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(160),
  description: z.string().max(5000).default(""),
  sku: z.string().trim().min(2, "Informe o código (SKU) do produto.").max(40).toUpperCase(),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  status: z.enum(STATUSES, { message: "Situação inválida." }),
  weightGrams: z.coerce.number().int().min(1, "Peso inválido.").max(50000),
  lengthCm: z.coerce.number().int().min(1, "Medida inválida.").max(200),
  widthCm: z.coerce.number().int().min(1, "Medida inválida.").max(200),
  heightCm: z.coerce.number().int().min(1, "Medida inválida.").max(200),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
});

class Conflict extends Error {}

export async function uniqueSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || "produto";
  let slug = root;
  for (let i = 2; await db.product.findFirst({ where: { slug, id: ignoreId ? { not: ignoreId } : undefined } }); i++) slug = `${root}-${i}`;
  return slug;
}

const fail = (fieldErrors: Record<string, string>, error?: string): SaveState => ({ ok: false, fieldErrors, error: error ?? Object.values(fieldErrors)[0] });

/**
 * Cria/atualiza produto + variações + estoque NUMA transação (ou tudo, ou nada).
 * Toda regra importante é conferida aqui, no servidor, independentemente da interface.
 */
export async function persistProduct(actor: Actor, input: ProductInput): Promise<SaveState> {
  const fe: Record<string, string> = {};
  const parsed = productSchema.safeParse(input.fields);
  if (!parsed.success) for (const i of parsed.error.issues) fe[String(i.path[0] ?? "form")] ??= i.message;
  const price = parseMoney(input.fields.price ?? "");
  if (price == null || price <= 0) fe.price ??= "Informe um preço de venda válido (ex.: 129,90).";
  const cost = parseMoney(input.fields.cost || "0") ?? 0;
  const promoRaw = (input.fields.promo ?? "").trim();
  const promo = promoRaw ? parseMoney(promoRaw) : null;
  if (promoRaw && (promo == null || (price != null && promo >= price))) fe.promo ??= "O preço promocional precisa ser menor que o preço de venda.";
  if (!parsed.success || fe.price || fe.promo) return fail(fe);
  const d = parsed.data;

  // categoria REAL (id do banco) → tipo (calçado, camiseta...) pela configuração central
  const cat = d.categoryId ? await db.category.findUnique({ where: { id: d.categoryId }, select: { id: true, slug: true, name: true } }) : null;
  if (d.categoryId && !cat) return fail({ categoryId: "Categoria não encontrada." });
  const kind = kindFor(cat, await loadGridConfig());

  const id = input.id || undefined;
  const existing = id ? await db.variant.findMany({ where: { productId: id } }) : [];
  if (id && !(await db.product.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "Produto não encontrado." };
  const byId = new Map(existing.map((v) => [v.id, v]));

  // ----- conjunto final de variações -----
  const finalInputs: VariantPayload[] = [];
  const payloadIds = new Set<string>();
  const existingColor = new Map(existing.map((v) => [v.color.toLowerCase(), v.color]));
  for (const [i, raw] of (input.variants ?? []).entries()) {
    const key = raw.key ?? `r${i}`;
    const size = normalizeSize(raw.size ?? "");
    let color = normalizeColor(raw.color ?? "") || "Único";
    if (raw.id) {
      const cur = byId.get(raw.id);
      if (!cur) { fe[`v:${key}:size`] = "Esta variação não pertence a este produto."; continue; }
      if (variantKey(size, color) !== variantKey(cur.size, cur.color)) { fe[`v:${key}:size`] = "Tamanho e cor de uma variação existente não podem ser alterados. Crie uma nova combinação e inative esta."; continue; }
      payloadIds.add(raw.id);
      color = cur.color;
    } else color = existingColor.get(color.toLowerCase()) ?? color; // mesma cor com outra caixa = mesma cor
    finalInputs.push({ ...raw, key, size, color });
  }
  // variações existentes que a tela não enviou ficam como estão (nunca zeradas por falta de dado)
  const untouched = new Set<string>();
  for (const v of existing) if (!payloadIds.has(v.id)) { untouched.add(v.id); finalInputs.push({ key: `u:${v.id}`, id: v.id, size: v.size, color: v.color, sku: v.sku, stock: v.stock, loadedStock: v.stock, active: v.active }); }
  if (Object.keys(fe).length) return fail(fe);

  const strictShoe = d.status !== "ARCHIVED";
  const { issues, rows } = validateVariants(finalInputs, { kind, productSku: d.sku, strictShoe, skipStockCheck: (r) => r.key.startsWith("u:") });
  for (const is of issues) {
    const k = is.rowKey && !is.rowKey.startsWith("u:") ? `v:${is.rowKey}:${is.field}` : is.field === "sizes" ? "sizes" : "variants";
    fe[k] ??= is.message;
  }
  if ((d.status === "PUBLISHED" || d.status === "UNAVAILABLE") && !rows.some((r) => r.active)) fe.variants ??= "Para publicar, ative ao menos uma variação (tamanho, cor e estoque). Ou salve como Inativo e complete depois.";

  // permissão de estoque: alterar quantidade de variação existente exige "stock.write"
  const canStock = actor.permissions.includes("stock.write");
  const changed = rows.filter((r) => r.id && !untouched.has(r.id) && r.stock !== byId.get(r.id)!.stock);
  if (changed.length && !canStock) fe.variants ??= "Você não tem permissão para alterar estoque. Peça a um Estoquista ou use o módulo Estoque.";
  if (Object.keys(fe).length) return fail(fe);

  // SKU do produto e das variações
  if (await db.product.findFirst({ where: { sku: d.sku, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) return fail({ sku: "Já existe outro produto com esse código SKU." });
  const wanted = rows.filter((r) => !untouched.has(r.id ?? ""));
  const taken = await db.variant.findMany({ where: { sku: { in: wanted.map((r) => r.sku) } }, select: { id: true, sku: true } });
  const takenMap = new Map(taken.map((t) => [t.sku, t.id]));
  const used = new Set<string>(rows.map((r) => r.sku));
  for (const r of wanted) {
    let owner = takenMap.get(r.sku);
    if (owner && owner !== r.id) {
      const auto = !((input.variants ?? []).find((p, i) => (p.key ?? `r${i}`) === r.key)?.sku ?? "").trim();
      if (auto && !r.id) { // SKU gerado automaticamente: procura um livre
        let n = 2; let cand = `${r.sku}-${n}`;
        while ((await db.variant.findUnique({ where: { sku: cand }, select: { id: true } })) || used.has(cand)) cand = `${r.sku}-${++n}`;
        r.sku = cand; used.add(cand); owner = undefined;
      } else fe[`v:${r.key}:sku`] = `O SKU "${r.sku}" já está em uso por outra variação.`;
    }
  }
  if (Object.keys(fe).length) return fail(fe);

  const data = {
    name: d.name, description: d.description, sku: d.sku, brand: d.brand || null, categoryId: d.categoryId || null, status: d.status,
    weightGrams: d.weightGrams, lengthCm: d.lengthCm, widthCm: d.widthCm, heightCm: d.heightCm,
    seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null,
    costCents: cost, priceCents: price!, promoPriceCents: promo,
    featured: input.featured, isNew: input.isNew,
  };

  try {
    const result = await db.$transaction(async (tx) => {
      let productId = id;
      let before: { priceCents: number; promoPriceCents: number | null; costCents: number; status: string } | null = null;
      if (id) {
        before = await tx.product.findUnique({ where: { id }, select: { priceCents: true, promoPriceCents: true, costCents: true, status: true } });
        // o endereço (slug) permanece o mesmo ao renomear: links já compartilhados continuam funcionando
        await tx.product.update({ where: { id }, data });
      } else {
        productId = (await tx.product.create({ data: { ...data, slug: await uniqueSlug(data.name) } })).id;
      }
      let created = 0, updated = 0, stockMoves = 0;
      for (const r of rows) {
        if (untouched.has(r.id ?? "")) continue;
        if (r.id) {
          const cur = byId.get(r.id)!;
          const patch: { sku?: string; active?: boolean } = {};
          if (r.sku !== cur.sku) patch.sku = r.sku;
          if (r.active !== cur.active) patch.active = r.active;
          if (Object.keys(patch).length) { await tx.variant.update({ where: { id: r.id }, data: patch }); updated++; }
          if (r.stock !== cur.stock) {
            // trava a linha e confere que ninguém vendeu/ajustou desde que a tela foi aberta
            const locked = await tx.$queryRaw<{ stock: number }[]>`SELECT "stock" FROM "Variant" WHERE "id" = ${r.id} FOR UPDATE`;
            if (r.loadedStock == null || locked[0].stock !== r.loadedStock) throw new Conflict(`O estoque de ${cur.size} / ${cur.color} mudou enquanto você editava (agora ${locked[0].stock}). Recarregue a página e confira antes de salvar.`);
            const delta = (r.stock as number) - locked[0].stock;
            if (delta !== 0) { await moveStock(tx, { variantId: r.id, delta, type: "ADJUSTMENT", reason: "Ajuste pelo cadastro do produto", userId: actor.id }); stockMoves++; }
          }
        } else if (r.active) {
          const row = await tx.variant.create({ data: { productId: productId!, sku: r.sku, size: r.size, color: r.color, stock: 0, active: true } });
          if ((r.stock as number) > 0) { await moveStock(tx, { variantId: row.id, delta: r.stock as number, type: "ENTRY", reason: "Estoque inicial", userId: actor.id }); stockMoves++; }
          created++;
        }
      }
      return { productId: productId!, before, created, updated, stockMoves };
    }, { timeout: 30000, maxWait: 10000 });

    const priceChanged = !!result.before && (result.before.priceCents !== data.priceCents || result.before.promoPriceCents !== data.promoPriceCents || result.before.costCents !== data.costCents);
    await audit(actor.id, id ? (priceChanged ? "product.update+price" : "product.update") : "product.create", "Product", result.productId, {
      sku: d.sku, variantsCreated: result.created, variantsUpdated: result.updated, stockMoves: result.stockMoves,
      ...(priceChanged ? { price: [result.before!.priceCents, data.priceCents], promo: [result.before!.promoPriceCents, data.promoPriceCents], cost: [result.before!.costCents, data.costCents] } : {}),
      ...(result.before && result.before.status !== data.status ? { status: [result.before.status, data.status] } : {}),
    });
    bustStore();
    return { ok: true, id: result.productId, created: !id };
  } catch (e) {
    if (e instanceof Conflict) return { ok: false, error: e.message, fieldErrors: { variants: e.message } };
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique")) return { ok: false, error: "Já existe um produto (ou variação) com esse SKU, ou tamanho/cor repetidos.", fieldErrors: { sku: "SKU ou combinação já existente." } };
    console.error("persistProduct", msg);
    return { ok: false, error: "Não foi possível salvar o produto. Nada foi gravado pela metade; tente novamente." };
  }
}

export { KIND_RULES, makeSku };
export type { CleanRow };
