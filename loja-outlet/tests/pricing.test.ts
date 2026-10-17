import { describe, expect, it } from "vitest";
import { discountPercent, effectivePrice, evaluateCoupon, quoteShipping, regionFromZip, type CouponRule } from "../lib/pricing";
import { parseMoney, brl } from "../lib/money";
import { toCsv } from "../lib/csv";
import { slugify } from "../lib/slug";
import { hasPermission, DEFAULT_ROLES } from "../lib/permissions";
import { verifySignature } from "../lib/payments/mercadopago";
import { createHmac } from "node:crypto";

const coupon = (o: Partial<CouponRule> = {}): CouponRule => ({ code: "X", type: "PERCENT", value: 10, minOrderCents: 0, startsAt: null, expiresAt: null, maxUses: null, maxUsesPerCustomer: null, productId: null, categoryId: null, active: true, ...o });
const lines = [{ productId: "a", categoryId: "c1", totalCents: 10000 }, { productId: "b", categoryId: "c2", totalCents: 5000 }];

describe("preço", () => {
  it("usa promoção só se menor que o preço", () => {
    expect(effectivePrice({ priceCents: 10000, promoPriceCents: 8000 })).toBe(8000);
    expect(effectivePrice({ priceCents: 10000, promoPriceCents: 12000 })).toBe(10000);
    expect(effectivePrice({ priceCents: 10000, promoPriceCents: null })).toBe(10000);
  });
  it("desconto automático", () => expect(discountPercent({ priceCents: 10000, promoPriceCents: 7500 })).toBe(25));
  it("parseMoney / brl", () => {
    expect(parseMoney("1.299,90")).toBe(129990);
    expect(parseMoney("49,9")).toBe(4990);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(brl(129990)).toContain("1.299,90");
  });
});

describe("cupom", () => {
  it("percentual e fixo", () => {
    expect(evaluateCoupon(coupon(), lines, { total: 0, byCustomer: 0 })).toEqual({ ok: true, discountCents: 1500 });
    expect(evaluateCoupon(coupon({ type: "FIXED", value: 2000 }), lines, { total: 0, byCustomer: 0 })).toEqual({ ok: true, discountCents: 2000 });
  });
  it("fixo nunca excede a base", () => expect(evaluateCoupon(coupon({ type: "FIXED", value: 99999 }), lines, { total: 0, byCustomer: 0 })).toEqual({ ok: true, discountCents: 15000 }));
  it("restrição por categoria/produto", () => {
    expect(evaluateCoupon(coupon({ categoryId: "c2" }), lines, { total: 0, byCustomer: 0 })).toEqual({ ok: true, discountCents: 500 });
    expect(evaluateCoupon(coupon({ productId: "zzz" }), lines, { total: 0, byCustomer: 0 }).ok).toBe(false);
  });
  it("validade, mínimo, limites, inativo", () => {
    const now = new Date("2026-06-01");
    expect(evaluateCoupon(coupon({ expiresAt: new Date("2026-01-01") }), lines, { total: 0, byCustomer: 0 }, now).ok).toBe(false);
    expect(evaluateCoupon(coupon({ startsAt: new Date("2027-01-01") }), lines, { total: 0, byCustomer: 0 }, now).ok).toBe(false);
    expect(evaluateCoupon(coupon({ minOrderCents: 20000 }), lines, { total: 0, byCustomer: 0 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ maxUses: 5 }), lines, { total: 5, byCustomer: 0 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ maxUsesPerCustomer: 1 }), lines, { total: 1, byCustomer: 1 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ active: false }), lines, { total: 0, byCustomer: 0 }).ok).toBe(false);
  });
});

describe("frete", () => {
  it("região por CEP e frete grátis", () => {
    expect(regionFromZip("01310-100")).toBe("SE");
    expect(regionFromZip("80010-000")).toBe("S");
    expect(regionFromZip("123")).toBeNull();
    expect(quoteShipping("01310100", 10000)?.priceCents).toBe(1990);
    expect(quoteShipping("01310100", 50000)?.priceCents).toBe(0);
    expect(quoteShipping("xx", 1)).toBeNull();
  });
});

describe("utilidades", () => {
  it("csv escapa e neutraliza fórmulas", () => {
    const out = toCsv([["a;b", '"q"', "=1+1"]]);
    expect(out).toContain('"a;b"');
    expect(out).toContain("'=1+1");
  });
  it("slug", () => expect(slugify("Camiseta Oversized Preta ção!")).toBe("camiseta-oversized-preta-cao"));
  it("permissões por perfil", () => {
    const stock = DEFAULT_ROLES.find((r) => r.name === "stockist")!;
    expect(hasPermission(stock.permissions, "stock.write")).toBe(true);
    expect(hasPermission(stock.permissions, "users.write")).toBe(false);
    expect(DEFAULT_ROLES.find((r) => r.name === "manager")!.permissions).not.toContain("users.write");
  });
});

describe("assinatura do webhook", () => {
  const secret = "s3cret";
  const sig = (id: string, ts: string, req: string) => `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id};request-id:${req};ts:${ts};`).digest("hex")}`;
  it("aceita assinatura válida e rejeita inválida", () => {
    expect(verifySignature({ signature: sig("123", "1", "r1"), requestId: "r1", dataId: "123", secret })).toBe(true);
    expect(verifySignature({ signature: sig("123", "1", "r1"), requestId: "r1", dataId: "124", secret })).toBe(false);
    expect(verifySignature({ signature: "ts=1,v1=abc", requestId: "r1", dataId: "123", secret })).toBe(false);
    expect(verifySignature({ signature: null, requestId: null, dataId: "1", secret })).toBe(false);
  });
});
