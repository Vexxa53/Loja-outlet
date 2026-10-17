// Regras de preço, cupom e frete — funções puras (testáveis).

export type PriceInput = { priceCents: number; promoPriceCents: number | null };

export function effectivePrice(p: PriceInput): number {
  return p.promoPriceCents != null && p.promoPriceCents > 0 && p.promoPriceCents < p.priceCents
    ? p.promoPriceCents
    : p.priceCents;
}

export function discountPercent(p: PriceInput): number {
  const e = effectivePrice(p);
  return e < p.priceCents ? Math.round((1 - e / p.priceCents) * 100) : 0;
}

export type CouponRule = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderCents: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  productId: string | null;
  categoryId: string | null;
  active: boolean;
};

export type Line = { productId: string; categoryId: string | null; totalCents: number };

export type CouponResult = { ok: true; discountCents: number } | { ok: false; error: string };

export function evaluateCoupon(
  c: CouponRule,
  lines: Line[],
  usage: { total: number; byCustomer: number },
  now = new Date(),
): CouponResult {
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
  if (!c.active) return { ok: false, error: "Cupom inativo." };
  if (c.startsAt && now < c.startsAt) return { ok: false, error: "Cupom ainda não está válido." };
  if (c.expiresAt && now > c.expiresAt) return { ok: false, error: "Cupom expirado." };
  if (subtotal < c.minOrderCents) return { ok: false, error: "Pedido abaixo do valor mínimo do cupom." };
  if (c.maxUses != null && usage.total >= c.maxUses) return { ok: false, error: "Cupom esgotado." };
  if (c.maxUsesPerCustomer != null && usage.byCustomer >= c.maxUsesPerCustomer)
    return { ok: false, error: "Você já utilizou este cupom o número máximo de vezes." };
  const eligible = lines.filter(
    (l) => (!c.productId || l.productId === c.productId) && (!c.categoryId || l.categoryId === c.categoryId),
  );
  const base = eligible.reduce((s, l) => s + l.totalCents, 0);
  if (base <= 0) return { ok: false, error: "Cupom não se aplica aos itens do carrinho." };
  const raw = c.type === "PERCENT" ? Math.floor((base * c.value) / 100) : c.value;
  return { ok: true, discountCents: Math.min(raw, base) };
}

export type ShippingConfig = {
  freeAboveCents: number;
  regions: Record<"N" | "NE" | "CO" | "SE" | "S", { priceCents: number; days: number }>;
};

export const DEFAULT_SHIPPING: ShippingConfig = {
  freeAboveCents: 39900,
  regions: {
    SE: { priceCents: 1990, days: 4 },
    S: { priceCents: 2490, days: 5 },
    CO: { priceCents: 2990, days: 6 },
    NE: { priceCents: 3490, days: 8 },
    N: { priceCents: 3990, days: 10 },
  },
};

export function regionFromZip(zip: string): keyof ShippingConfig["regions"] | null {
  const d = zip.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const n = Number(d.slice(0, 5));
  if (n < 20000) return "SE"; // SP
  if (n < 30000) return "SE"; // RJ/ES
  if (n < 40000) return "SE"; // MG
  if (n < 49000) return "NE"; // BA/SE
  if (n < 65000) return "NE"; // AL..MA
  if (n < 70000) return "N"; // PA/AM/AP/RR/AC
  if (n < 77000) return "CO"; // DF/GO/MT/MS/TO
  if (n < 78000) return "N"; // RO/TO
  if (n < 80000) return "CO";
  return "S"; // PR/SC/RS
}

export type ShippingQuote = { method: string; label: string; priceCents: number; days: number };

export function quoteShipping(zip: string, subtotalCents: number, cfg: ShippingConfig = DEFAULT_SHIPPING): ShippingQuote | null {
  const r = regionFromZip(zip);
  if (!r) return null;
  const { priceCents, days } = cfg.regions[r];
  const free = subtotalCents >= cfg.freeAboveCents;
  return { method: "standard", label: free ? "Frete grátis" : "Entrega padrão", priceCents: free ? 0 : priceCents, days };
}
