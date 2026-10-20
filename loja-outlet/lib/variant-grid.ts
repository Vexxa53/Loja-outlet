import { sortSizes } from "./nav";
import { makeSku, normalizeColor, normalizeSize, UNIQUE_COLOR, UNIQUE_SIZE, variantKey } from "./size-grids";

/** Estado da matriz tamanho × cor do formulário (puro, testável). Linhas existentes nunca somem: só ficam inativas. */
export type VRow = { key: string; id?: string; size: string; color: string; sku: string; stock: string; loadedStock: number | null; active: boolean };
export type GridState = { sizes: string[]; colors: string[]; rows: VRow[] };
export type ExistingVariant = { id: string; size: string; color: string; sku: string; stock: number; active: boolean };

const newKey = (size: string, color: string) => `n:${variantKey(size, color)}`;

export function initGrid(variants: ExistingVariant[]): GridState {
  return {
    sizes: sortSizes([...new Set(variants.map((v) => v.size))]),
    colors: [...new Set(variants.map((v) => v.color))].sort((a, b) => a.localeCompare(b)),
    rows: variants.map((v) => ({ key: v.id, id: v.id, size: v.size, color: v.color, sku: v.sku, stock: String(v.stock), loadedStock: v.stock, active: v.active })),
  };
}

function upsertCombo(rows: VRow[], size: string, color: string): VRow[] {
  const k = variantKey(size, color);
  const i = rows.findIndex((r) => variantKey(r.size, r.color) === k);
  if (i >= 0) return rows[i].active ? rows : rows.map((r, j) => (j === i ? { ...r, active: true } : r));
  return [...rows, { key: newKey(size, color), size, color, sku: "", stock: "", loadedStock: null, active: true }];
}

export function addSize(s: GridState, raw: string): GridState {
  const size = normalizeSize(raw);
  if (!size) return s;
  const sizes = s.sizes.some((x) => x.toLowerCase() === size.toLowerCase()) ? s.sizes : sortSizes([...s.sizes, size]);
  let rows = s.rows;
  // as combinações só existem quando há tamanho E cor escolhidos ("Sem variação de cor" é uma escolha explícita)
  for (const c of s.colors) rows = upsertCombo(rows, size, c);
  return { ...s, sizes, rows };
}

export function removeSize(s: GridState, size: string): GridState {
  return {
    ...s,
    sizes: s.sizes.filter((x) => x !== size),
    rows: s.rows.filter((r) => r.size !== size || r.id).map((r) => (r.size === size ? { ...r, active: false } : r)),
  };
}

export function addColor(s: GridState, raw: string): GridState {
  const color = normalizeColor(raw);
  if (!color) return s;
  // escolher uma cor "de verdade" tira a "Única" (as linhas existentes ficam inativas, sem apagar histórico)
  let base = s;
  if (color !== UNIQUE_COLOR && s.colors.includes(UNIQUE_COLOR)) base = removeColor(s, UNIQUE_COLOR);
  if (color === UNIQUE_COLOR && base.colors.some((c) => c !== UNIQUE_COLOR)) for (const c of [...base.colors]) base = removeColor(base, c);
  const colors = base.colors.some((x) => x.toLowerCase() === color.toLowerCase()) ? base.colors : [...base.colors, color];
  let rows = base.rows;
  for (const size of base.sizes) rows = upsertCombo(rows, size, color);
  return { ...base, colors, rows };
}

export function removeColor(s: GridState, color: string): GridState {
  return {
    ...s,
    colors: s.colors.filter((x) => x !== color),
    rows: s.rows.filter((r) => r.color !== color || r.id).map((r) => (r.color === color ? { ...r, active: false } : r)),
  };
}

export function setRow(s: GridState, key: string, patch: Partial<VRow>): GridState {
  return { ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
}

export function fillEmptyStock(s: GridState, value: string): GridState {
  return { ...s, rows: s.rows.map((r) => (!r.id && r.active && r.stock.trim() === "" ? { ...r, stock: value } : r)) };
}

export function sortedRows(rows: VRow[]): VRow[] {
  const order = sortSizes([...new Set(rows.map((r) => r.size))]);
  return [...rows].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size) || a.color.localeCompare(b.color));
}

/** Linhas que serão enviadas: todas as existentes + as novas marcadas como ativas. */
export const rowsToSave = (s: GridState) => s.rows.filter((r) => r.id || r.active);
export function counts(s: GridState) {
  const save = rowsToSave(s);
  const active = save.filter((r) => r.active);
  const stock = active.reduce((n, r) => n + (/^\d+$/.test(r.stock.trim()) ? Number(r.stock) : 0), 0);
  return { total: save.length, created: save.filter((r) => !r.id).length, existing: save.filter((r) => r.id).length, inactive: save.filter((r) => !r.active).length, active: active.length, stock };
}

export const previewSku = (productSku: string, r: Pick<VRow, "size" | "color">) => makeSku(productSku || "PRODUTO", r.size || UNIQUE_SIZE, r.color || UNIQUE_COLOR);
