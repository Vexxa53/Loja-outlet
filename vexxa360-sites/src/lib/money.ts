// Dinheiro: trabalhamos em CENTAVOS inteiros para cálculos; o banco usa numeric(12,2).
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  return brl.format(Number(value ?? 0));
}

export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Converte "149,90" / "1.299,90" / "149.90" em número com 2 casas; NaN se inválido. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === "number") return Number.isFinite(input) ? fromCents(toCents(input)) : NaN;
  const raw = String(input ?? "").trim().replace(/[R$\s]/g, "");
  if (!raw) return NaN;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return fromCents(toCents(normalized));
}

/** Percentual de desconto inteiro: de 149,90 por 99,90 → 33. */
export function discountPercent(regular: number, effective: number): number {
  if (!(regular > 0) || effective >= regular) return 0;
  return Math.round((1 - toCents(effective) / toCents(regular)) * 100);
}
