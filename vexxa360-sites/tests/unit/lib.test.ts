import { describe, expect, it } from "vitest";
import { discountPercent, formatBRL, fromCents, parseMoney, toCents } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { buildWhatsAppMessage, normalizeBrPhone, whatsappUrl } from "@/lib/whatsapp";
import { checkImage, sniffImageType } from "@/lib/images";
import { readableOn } from "@/lib/color";
import { safeNext } from "@/lib/safe-next";
import { rateLimit } from "@/lib/rate-limit";
import { productSchema } from "@/lib/validation/product";
import { brandingSchema, bannerSchema, checkoutSchema, promotionSchema, settingsSchema } from "@/lib/validation/store";
import { brLocalToIso } from "@/lib/validation/common";

describe("dinheiro", () => {
  it("interpreta formatos brasileiros", () => {
    expect(parseMoney("149,90")).toBe(149.9);
    expect(parseMoney("1.299,90")).toBe(1299.9);
    expect(parseMoney("R$ 99,9")).toBe(99.9);
    expect(parseMoney("100")).toBe(100);
    expect(parseMoney("149.90")).toBe(149.9);
  });
  it("rejeita lixo e valores com mais de 2 casas", () => {
    for (const bad of ["", "abc", "1,234", "12,3,4", "--5", "1e3"]) expect(parseMoney(bad)).toBeNaN();
  });
  it("não sofre erro de ponto flutuante", () => {
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3);
    expect(toCents(19.99) * 3).toBe(5997);
  });
  it("calcula percentual: de 149,90 por 99,90 = 33%", () => {
    expect(discountPercent(149.9, 99.9)).toBe(33);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });
  it("formata em BRL", () => expect(formatBRL(99.9).replace(/\s/g, " ")).toBe("R$ 99,90"));
});

describe("slug", () => {
  it("remove acentos e símbolos", () => {
    expect(slugify("Camiseta Básica — Edição #2!")).toBe("camiseta-basica-edicao-2");
    expect(slugify("  Última Peça  ")).toBe("ultima-peca");
  });
});

describe("whatsapp", () => {
  it("normaliza telefones brasileiros", () => {
    expect(normalizeBrPhone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizeBrPhone("11 3333-4444")).toBe("551133334444");
    expect(normalizeBrPhone("123")).toBeNull();
  });
  it("monta mensagem com os dados do snapshot", () => {
    const msg = buildWhatsAppMessage({
      order_number: 12, subtotal: 449.7, discount_amount: 150, total: 299.7, store_name: "Loja A", whatsapp: "5511999990001",
      items: [{ name: "Camiseta", size: "M", color: "Preta", quantity: 3, unit_price: 99.9, regular_unit_price: 149.9 }],
    }, "Maria", "entregar à tarde");
    expect(msg).toContain("#12");
    expect(msg).toContain("3x Camiseta (Tam. M · Preta)");
    expect(msg).toMatch(/Total: R\$\s299,70/);
    expect(msg).toContain("Maria");
    expect(msg).toContain("entregar à tarde");
  });
  it("gera URL wa.me válida e recusa número inválido", () => {
    expect(whatsappUrl("5511999990001", "oi mundo")).toBe("https://wa.me/5511999990001?text=oi%20mundo");
    expect(whatsappUrl("abc", "x")).toBeNull();
    expect(whatsappUrl(null, "x")).toBeNull();
  });
});

describe("upload de imagem", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
  it("reconhece formatos pelos bytes", () => {
    expect(sniffImageType(jpeg)?.mime).toBe("image/jpeg");
    expect(sniffImageType(png)?.mime).toBe("image/png");
    expect(sniffImageType(webp)?.mime).toBe("image/webp");
  });
  it("recusa scripts/HTML/SVG disfarçados e arquivos grandes ou vazios", () => {
    expect(checkImage(new TextEncoder().encode("<svg onload=alert(1)>")).ok).toBe(false);
    expect(checkImage(new TextEncoder().encode("<?php echo 1; ?>")).ok).toBe(false);
    expect(checkImage(new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set(jpeg);
    expect(checkImage(big)).toEqual({ ok: false, error: "A imagem excede 4 MB." });
    expect(checkImage(jpeg).ok).toBe(true);
  });
});

describe("segurança de redirecionamento e limites", () => {
  it("safeNext bloqueia open redirect", () => {
    expect(safeNext("/admin/produtos")).toBe("/admin/produtos");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined]) expect(safeNext(bad as string)).toBe("/admin");
  });
  it("rate limit bloqueia após o limite", () => {
    const k = "t:" + Math.random();
    expect([1, 2, 3, 4].map(() => rateLimit(k, 3, 1000))).toEqual([true, true, true, false]);
  });
  it("cor legível sobre a marca", () => {
    expect(readableOn("#111111")).toBe("#ffffff");
    expect(readableOn("#f5f5f5")).toBe("#111111");
  });
});

const baseProduct = { name: "Camiseta", regularPrice: "149,90", status: "draft", variants: JSON.stringify([{ size: "M", color: "Preta", stock: 3, active: true }]) };

describe("validação de produto", () => {
  it("aceita produto válido e converte valores", () => {
    const r = productSchema.safeParse({ ...baseProduct, promotionalPrice: "99,90", costPrice: "40,00", tags: "verão, linho", featured: "on" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.regularPrice).toBe(149.9); expect(r.data.promotionalPrice).toBe(99.9); expect(r.data.tags).toEqual(["verão", "linho"]); expect(r.data.featured).toBe(true); }
  });
  it("rejeita preço negativo, promocional ≥ normal, nome vazio", () => {
    expect(productSchema.safeParse({ ...baseProduct, regularPrice: "-10" }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, promotionalPrice: "149,90" }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, promotionalPrice: "200,00" }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, name: "  " }).success).toBe(false);
  });
  it("rejeita estoque negativo/fracionado, variação repetida e publicação sem variação", () => {
    const v = (arr: unknown[]) => JSON.stringify(arr);
    expect(productSchema.safeParse({ ...baseProduct, variants: v([{ size: "M", stock: -1 }]) }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, variants: v([{ size: "M", stock: 1.5 }]) }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, variants: v([{ size: "M", color: "Preta", stock: 1 }, { size: "m", color: "preta", stock: 2 }]) }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, status: "published", variants: "[]" }).success).toBe(false);
    expect(productSchema.safeParse({ ...baseProduct, status: "draft", variants: "[]" }).success).toBe(true);
    expect(productSchema.safeParse({ ...baseProduct, variants: "isto não é json" }).success).toBe(false);
  });
});

describe("validação de loja", () => {
  it("cores só no formato #RRGGBB (sem injeção de CSS)", () => {
    const ok = { storeName: "Loja", primaryColor: "#112233", secondaryColor: "#aabbcc" };
    expect(brandingSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["red", "#12345", "#12345g", "#112233; background:url(x)", "url(javascript:1)"]) {
      expect(brandingSchema.safeParse({ ...ok, primaryColor: bad }).success).toBe(false);
    }
  });
  it("instagram aceita usuário ou link e recusa lixo", () => {
    const ok = { storeName: "Loja", primaryColor: "#112233", secondaryColor: "#aabbcc" };
    const r = brandingSchema.safeParse({ ...ok, instagram: "@minha.loja" });
    expect(r.success && r.data.instagram).toBe("minha.loja");
    expect(brandingSchema.safeParse({ ...ok, instagram: "https://instagram.com/loja_x/" }).success).toBe(true);
    expect(brandingSchema.safeParse({ ...ok, instagram: "<script>" }).success).toBe(false);
  });
  it("links de política só https; whatsapp normalizado", () => {
    const base = { whatsapp: "(11) 99999-0001", lowStockThreshold: "3", reservationHours: "48" };
    const r = settingsSchema.safeParse(base);
    expect(r.success && r.data.whatsapp).toBe("5511999990001");
    expect(settingsSchema.safeParse({ ...base, privacyUrl: "http://x.com" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, privacyUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, privacyUrl: "https://x.com/p" }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...base, whatsapp: "123" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, reservationHours: "0" }).success).toBe(false);
  });
  it("destino de banner: caminho interno ou https", () => {
    const b = { title: "x" };
    expect(bannerSchema.safeParse({ ...b, destinationUrl: "/loja/x/produtos" }).success).toBe(true);
    expect(bannerSchema.safeParse({ ...b, destinationUrl: "https://x.com" }).success).toBe(true);
    for (const bad of ["//evil.com", "javascript:alert(1)", "http://x.com", "data:text/html,x"]) expect(bannerSchema.safeParse({ ...b, destinationUrl: bad }).success).toBe(false);
  });
});

describe("promoções", () => {
  const ok = { name: "Liquida", discountType: "percent", discountValue: "20", startsAt: "2030-01-10T10:00", endsAt: "2030-01-20T10:00", active: "on" };
  it("aceita campanha válida e converte horário de Brasília para UTC", () => {
    const r = promotionSchema.safeParse(ok);
    expect(r.success && r.data.startsAt).toBe("2030-01-10T13:00:00.000Z");
    expect(brLocalToIso("lixo")).toBeNull();
  });
  it("rejeita valor zero/negativo, >90%, fim antes do início e preço fixo sem produto", () => {
    expect(promotionSchema.safeParse({ ...ok, discountValue: "0" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...ok, discountValue: "-5" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...ok, discountValue: "95" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...ok, endsAt: "2030-01-09T10:00" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...ok, discountType: "fixed_price", discountValue: "99,90" }).success).toBe(false);
  });
});

describe("checkout", () => {
  const item = { variantId: "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f", quantity: 2 };
  const ok = { slug: "loja-a", name: "Maria", phone: "(11) 99999-8888", items: [item] };
  it("aceita pedido válido", () => expect(checkoutSchema.safeParse(ok).success).toBe(true));
  it("rejeita sacola vazia, quantidade inválida, telefone ruim, id forjado", () => {
    expect(checkoutSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, items: [{ ...item, quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, items: [{ ...item, quantity: 1000 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, items: [{ ...item, quantity: -1 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, items: [{ variantId: "' or 1=1 --", quantity: 1 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, name: "A" }).success).toBe(false);
  });
  it("ignora preço enviado pelo navegador (campo nem existe no schema)", () => {
    const r = checkoutSchema.safeParse({ ...ok, items: [{ ...item, unitPrice: 0.01 }], total: 1 });
    expect(r.success).toBe(true);
    if (r.success) expect(JSON.stringify(r.data)).not.toContain("0.01");
  });
});
