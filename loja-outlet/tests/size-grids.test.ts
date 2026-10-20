import { describe, expect, it } from "vitest";
import { COLOR_PRESETS, DEFAULT_GRIDS, gridFor, guessKind, isNumericSize, kindFor, makeSku, normalizeColor, normalizeSize } from "../lib/size-grids";
import { NEED_SIZE_MSG, parseStock, validateVariants } from "../lib/variant-rules";

describe("grades e categorias", () => {
  it("identifica calçados pela categoria (todas as subcategorias), não pelo nome do produto", () => {
    for (const [slug, name] of [["tenis", "Tênis"], ["sapatos", "Sapatos"], ["botas", "Botas"], ["sandalias", "Sandálias"], ["chinelos", "Chinelos"], ["calcados-femininos", "Calçados"]]) expect(guessKind({ slug, name })).toBe("calcado");
    expect(guessKind({ slug: "camisas", name: "Camisas" })).toBe("camiseta");
    expect(guessKind({ slug: "blusas-e-jaquetas", name: "Blusas e jaquetas" })).toBe("blusa");
    expect(guessKind({ slug: "calcas", name: "Calças" })).toBe("calca");
    expect(guessKind({ slug: "relogios", name: "Relógios" })).toBe("relogio");
    expect(guessKind({ slug: "oculos", name: "Óculos" })).toBe("oculos");
    expect(guessKind({ slug: "perfumes", name: "Perfumes" })).toBe("outros");
    expect(kindFor(null)).toBe("outros");
  });
  it("o administrador pode reclassificar categoria e ampliar a grade", () => {
    const cfg = { grids: { calcado: ["33", "34", "35"] }, categoryKinds: { acessorios: "calcado" as const } };
    expect(kindFor({ slug: "acessorios", name: "Acessórios" }, cfg)).toBe("calcado");
    expect(gridFor("calcado", cfg)).toEqual(["33", "34", "35"]);
    expect(gridFor("calca")).toEqual(DEFAULT_GRIDS.calca);
  });
  it("grades iniciais conforme o pedido", () => {
    expect(DEFAULT_GRIDS.calcado).toEqual(["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"]);
    expect(DEFAULT_GRIDS.camiseta).toEqual(["PP", "P", "M", "G", "GG", "XGG"]);
    expect(DEFAULT_GRIDS.calca).toEqual(["36", "38", "40", "42", "44", "46", "48"]);
  });
  it("normaliza tamanho/cor e valida numeração", () => {
    expect(normalizeSize(" 37,5 ")).toBe("37.5"); expect(normalizeSize("gg")).toBe("GG"); expect(normalizeSize("unico")).toBe("Único"); expect(normalizeSize("ÚNICO")).toBe("Único"); expect(normalizeColor("  azul   marinho")).toBe("Azul marinho");
    expect(isNumericSize("38")).toBe(true); expect(isNumericSize("37.5")).toBe(true);
    for (const bad of ["M", "Único", "8", "99", "38.3", "", "3a"]) expect(isNumericSize(bad)).toBe(false);
  });
  it("gera SKU sem acentos/espaços", () => {
    expect(makeSku("cam001", "M", "Azul-marinho")).toBe("CAM001-M-AZUL-MARINHO");
    expect(makeSku("TEN1", "37.5", "Verde oliva")).toBe("TEN1-37-5-VERDE-OLIVA");
    expect(makeSku("REL1", "Único", "Único")).toBe("REL1-UN");
    expect(COLOR_PRESETS).toContain("Azul-marinho"); expect(COLOR_PRESETS).toContain("Preto");
  });
});

describe("validação de variações", () => {
  const row = (size: string, color: string, stock: string | number | null, extra: object = {}) => ({ size, color, stock, active: true, ...extra });
  it("estoque: inteiro >= 0; vazio, negativo, decimal e texto são erros (nada vira 0 em silêncio)", () => {
    expect(parseStock("0")).toEqual({ ok: true, value: 0 }); expect(parseStock(7)).toEqual({ ok: true, value: 7 });
    for (const bad of ["", "  ", null, undefined, "-1", "1.5", "1,5", "abc", "1e3", "100001"]) expect(parseStock(bad as never).ok).toBe(false);
  });
  it("calçado sem numeração é rejeitado com a mensagem exata", () => {
    const r = validateVariants([], { kind: "calcado", productSku: "T1", strictShoe: true });
    expect(r.issues.map((i) => i.message)).toContain(NEED_SIZE_MSG);
    const r2 = validateVariants([row("M", "Preto", 1)], { kind: "calcado", productSku: "T1", strictShoe: true });
    expect(r2.issues.some((i) => i.message === NEED_SIZE_MSG)).toBe(true);
    const ok = validateVariants([row("37", "Preto", 4), row("38", "Preto", 8)], { kind: "calcado", productSku: "T1", strictShoe: true });
    expect(ok.issues).toEqual([]);
  });
  it("roupas e outros não exigem numeração; combinações repetidas são recusadas (sem diferenciar maiúsculas)", () => {
    expect(validateVariants([row("M", "Preto", 1)], { kind: "camiseta", productSku: "C1", strictShoe: true }).issues).toEqual([]);
    expect(validateVariants([row("Único", "Único", 3)], { kind: "relogio", productSku: "R1", strictShoe: true }).issues).toEqual([]);
    const dup = validateVariants([row("M", "Preto", 1), row("m", "preto", 2)], { kind: "camiseta", productSku: "C1", strictShoe: true });
    expect(dup.issues.some((i) => /repetida/.test(i.message))).toBe(true);
  });
  it("linhas inativas de calçado não bloqueiam, mas é preciso ao menos uma numeração ativa", () => {
    const r = validateVariants([row("37", "Preto", 1, { active: false }), row("Único", "Preto", 1, { active: false })], { kind: "calcado", productSku: "T1", strictShoe: true });
    expect(r.issues.some((i) => i.message === NEED_SIZE_MSG)).toBe(true);
  });
});
