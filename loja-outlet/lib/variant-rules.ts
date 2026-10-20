import { isNumericSize, makeSku, normalizeColor, normalizeSize, variantKey, type Kind, KIND_RULES, UNIQUE_COLOR, UNIQUE_SIZE } from "./size-grids";

/** Regras puras de variações (usadas no navegador para feedback imediato e no servidor, que é quem decide). */
export type VariantInput = {
  key?: string;                 // identificador da linha na tela (devolvido nos erros)
  id?: string;                  // variação já existente
  size: string; color: string;
  sku?: string;
  stock: string | number | null | undefined;
  loadedStock?: number | null;  // estoque que o administrador viu ao abrir (controle de concorrência)
  active: boolean;
};
export type Issue = { rowKey: string | null; field: "size" | "color" | "sku" | "stock" | "sizes" | "variants"; message: string };
export type CleanRow = { key: string; id?: string; size: string; color: string; sku: string; stock: number | null; loadedStock: number | null; active: boolean };

export const NEED_SIZE_MSG = "Selecione pelo menos um tamanho para este calçado.";
const SKU_RE = /^[A-Z0-9][A-Z0-9._-]{1,59}$/;

/** Estoque físico: só inteiro >= 0. Vazio = erro (nunca vira 0 em silêncio). */
export function parseStock(v: string | number | null | undefined): { ok: true; value: number } | { ok: false; message: string } {
  if (v === null || v === undefined || String(v).trim() === "") return { ok: false, message: "Informe o estoque (use 0 se não houver)." };
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return { ok: false, message: /^-/.test(s) ? "O estoque não pode ser negativo." : "Use apenas números inteiros no estoque." };
  const n = Number(s);
  if (n > 100000) return { ok: false, message: "Estoque acima do limite (100.000)." };
  return { ok: true, value: n };
}

export function cleanRows(inputs: VariantInput[], productSku: string): CleanRow[] {
  return inputs.map((r, i) => {
    const size = normalizeSize(r.size ?? "");
    const color = normalizeColor(r.color ?? "") || UNIQUE_COLOR;
    const st = parseStock(r.stock);
    return {
      key: r.key ?? `r${i}`, id: r.id, size: size || "", color, sku: (r.sku ?? "").trim().toUpperCase() || makeSku(productSku || "PROD", size || UNIQUE_SIZE, color),
      stock: st.ok ? st.value : null, loadedStock: r.loadedStock ?? null, active: r.active,
    };
  });
}

/**
 * Valida o conjunto FINAL de variações do produto.
 * `kind` vem da categoria real; `strictShoe` aplica a regra de calçado (toda gravação, exceto arquivados).
 */
export function validateVariants(inputs: VariantInput[], ctx: { kind: Kind; productSku: string; strictShoe: boolean; skipStockCheck?: (r: CleanRow) => boolean }): { issues: Issue[]; rows: CleanRow[] } {
  const issues: Issue[] = [];
  const rows = cleanRows(inputs, ctx.productSku);
  const seen = new Map<string, string>();
  const seenSku = new Map<string, string>();
  rows.forEach((r, i) => {
    const raw = inputs[i];
    if (!r.size) issues.push({ rowKey: r.key, field: "size", message: "Informe o tamanho." });
    if (r.size.length > 12) issues.push({ rowKey: r.key, field: "size", message: "Tamanho muito longo (máx. 12 caracteres)." });
    if (r.color.length > 30) issues.push({ rowKey: r.key, field: "color", message: "Nome da cor muito longo (máx. 30 caracteres)." });
    if (!SKU_RE.test(r.sku)) issues.push({ rowKey: r.key, field: "sku", message: "SKU inválido: use letras, números, ponto, hífen ou sublinhado (2 a 60 caracteres)." });
    const dupSku = seenSku.get(r.sku);
    if (dupSku) issues.push({ rowKey: r.key, field: "sku", message: `SKU "${r.sku}" repetido nesta lista.` }); else seenSku.set(r.sku, r.key);
    const k = variantKey(r.size, r.color);
    if (seen.has(k)) issues.push({ rowKey: r.key, field: "size", message: `Combinação repetida: ${r.size} / ${r.color}.` }); else seen.set(k, r.key);
    if (!(ctx.skipStockCheck?.(r))) {
      const st = parseStock(raw.stock);
      if (!st.ok) issues.push({ rowKey: r.key, field: "stock", message: st.message });
    }
  });
  if (ctx.strictShoe && KIND_RULES[ctx.kind].requiresNumericSize) {
    const active = rows.filter((r) => r.active);
    if (!active.some((r) => isNumericSize(r.size))) issues.push({ rowKey: null, field: "sizes", message: NEED_SIZE_MSG });
    for (const r of active) if (r.size && !isNumericSize(r.size)) issues.push({ rowKey: r.key, field: "size", message: `Calçado exige numeração válida (ex.: 38 ou 37.5). "${r.size}" não é aceito.` });
  }
  return { issues, rows };
}
