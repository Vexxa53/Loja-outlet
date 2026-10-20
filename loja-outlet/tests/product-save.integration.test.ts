// Cadastro/edição de produtos, variações e estoque contra PostgreSQL real (INTEGRATION=1).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { persistProduct, type Actor, type ProductInput } from "../lib/product-save";
import { NEED_SIZE_MSG } from "../lib/variant-rules";
import { moveStock } from "../lib/stock";

const run = process.env.INTEGRATION === "1";
const db = new PrismaClient();
const d = run ? describe : describe.skip;
const FULL: Actor = { id: null, permissions: ["products.write", "stock.write"] };
const PROD_ONLY: Actor = { id: null, permissions: ["products.write"] };
const tag = `PS${Date.now().toString(36).toUpperCase()}`;

const fields = (sku: string, categoryId: string | null, extra: Record<string, string> = {}): Record<string, string> => ({
  name: `Produto ${sku}`, sku, categoryId: categoryId ?? "", status: "DRAFT", price: "199,90", promo: "", cost: "", brand: "", description: "x",
  weightGrams: "300", lengthCm: "30", widthCm: "25", heightCm: "5", ...extra,
});
const v = (size: string, color: string, stock: string | number | null, extra: object = {}) => ({ key: `${size}|${color}`, size, color, stock, active: true, ...extra });
const input = (f: Record<string, string>, variants?: ProductInput["variants"], id?: string): ProductInput => ({ id, fields: f, featured: false, isNew: false, variants });

d("cadastro de produtos com tamanhos, cores e estoque", () => {
  const cats: Record<string, string> = {};
  const skus: string[] = [];
  const sku = (n: string) => { const s = `${tag}-${n}`; skus.push(s); return s; };

  beforeAll(async () => {
    const make = async (slug: string, name: string) => { cats[slug] = (await db.category.create({ data: { name, slug: `${tag.toLowerCase()}-${slug}` } })).id; };
    await make("tenis", "Tênis"); await make("sapatos", "Sapatos"); await make("botas", "Botas"); await make("sandalias", "Sandálias"); await make("chinelos", "Chinelos");
    await make("camisetas", "Camisetas"); await make("relogios", "Relógios"); await make("perfumes", "Perfumes");
  });
  afterAll(async () => {
    await db.product.deleteMany({ where: { sku: { in: skus } } });
    await db.category.deleteMany({ where: { id: { in: Object.values(cats) } } });
    await db.$disconnect();
  });
  const load = (s: string) => db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });

  it("A: calçado sem numeração é rejeitado no servidor (mensagem exata) e nada é gravado", async () => {
    const s = sku("A");
    const r = await persistProduct(FULL, input(fields(s, cats.tenis), []));
    expect(r.ok).toBe(false); expect(r.fieldErrors?.sizes).toBe(NEED_SIZE_MSG);
    expect(await db.product.count({ where: { sku: s } })).toBe(0);
    // também sem enviar o campo "variants" (requisição forjada) e publicando
    expect((await persistProduct(FULL, input(fields(sku("A2"), cats.tenis, { status: "PUBLISHED" })))).ok).toBe(false);
    // tamanhos que não são numeração
    const r3 = await persistProduct(FULL, input(fields(sku("A3"), cats.tenis), [v("M", "Preto", 1)]));
    expect(r3.ok).toBe(false);
  });

  it("C: todas as categorias de calçado exigem numeração", async () => {
    for (const c of ["tenis", "sapatos", "botas", "sandalias", "chinelos"]) {
      const bad = await persistProduct(FULL, input(fields(sku(`C-${c}`), cats[c]), []));
      expect(bad.ok, c).toBe(false); expect(bad.fieldErrors?.sizes, c).toBe(NEED_SIZE_MSG);
      const ok = await persistProduct(FULL, input(fields(sku(`C2-${c}`), cats[c]), [v("38", "Preto", 2)]));
      expect(ok.ok, c).toBe(true);
    }
  });

  it("B: várias numerações × duas cores com estoques diferentes persistem e voltam iguais", async () => {
    const s = sku("B");
    const rows = [["37", "Preto", 4], ["38", "Preto", 8], ["39", "Preto", 6], ["40", "Preto", 3], ["38", "Branco", 5], ["39", "Branco", 2]] as const;
    const r = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), rows.map(([a, b, c]) => v(a, b, c))));
    expect(r.ok).toBe(true);
    const p = await load(s);
    expect(p.variants.length).toBe(6);
    for (const [a, b, c] of rows) expect(p.variants.find((x) => x.size === a && x.color === b)!.stock).toBe(c);
    expect(p.variants.find((x) => x.size === "37")!.sku).toBe(`${s}-37-PRETO`);
    // histórico de estoque inicial
    expect(await db.stockMovement.count({ where: { variant: { productId: p.id }, type: "ENTRY" } })).toBe(6);
  });

  it("D: camisetas com cor personalizada e só alguns tamanhos; edição preserva o resto", async () => {
    const s = sku("D");
    const r = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [v("PP", "Verde-militar", 1), v("M", "Verde-militar", 9), v("XGG", "Preto", 0)]));
    expect(r.ok).toBe(true);
    const p = await load(s);
    expect(p.variants.map((x) => x.size).sort()).toEqual(["M", "PP", "XGG"]);
    const m = p.variants.find((x) => x.size === "M")!;
    const edit = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED", name: "Camiseta renomeada" }), p.variants.map((x) => ({ key: x.id, id: x.id, size: x.size, color: x.color, sku: x.sku, stock: x.stock, loadedStock: x.stock, active: x.active })), p.id));
    expect(edit.ok).toBe(true);
    const q = await load(s);
    expect(q.name).toBe("Camiseta renomeada"); expect(q.slug).toBe(p.slug);
    expect(q.variants.find((x) => x.id === m.id)!.stock).toBe(9);
    expect(await db.stockMovement.count({ where: { variantId: m.id } })).toBe(1); // sem ajuste desnecessário
  });

  it("E: combinação duplicada (mesmo com outra caixa) é recusada; inativa não é criada", async () => {
    const dup = await persistProduct(FULL, input(fields(sku("E1"), cats.camisetas), [v("M", "Preto", 1), v("m", "preto", 2)]));
    expect(dup.ok).toBe(false); expect(Object.values(dup.fieldErrors ?? {}).join(" ")).toMatch(/repetida/);
    const s = sku("E2");
    const ok = await persistProduct(FULL, input(fields(s, cats.camisetas), [v("M", "Preto", 1), v("M", "Branco", 2, { active: false }), v("G", "Preto", 3)]));
    expect(ok.ok).toBe(true);
    expect((await load(s)).variants.map((x) => `${x.size}|${x.color}`).sort()).toEqual(["G|Preto", "M|Preto"]);
  });

  it("F: altera o estoque de uma variação sem mexer nas outras; valores inválidos são recusados", async () => {
    const s = sku("F");
    await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), [v("38", "Preto", 5), v("39", "Preto", 7), v("40", "Preto", 3)]));
    const p = await load(s);
    const rows = (over: Record<string, string>) => p.variants.map((x) => ({ key: x.id, id: x.id, size: x.size, color: x.color, sku: x.sku, stock: over[x.size] ?? x.stock, loadedStock: x.stock, active: true }));
    for (const bad of ["", "-1", "1.5", "abc"]) {
      const r = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), rows({ "39": bad }), p.id));
      expect(r.ok, `"${bad}"`).toBe(false);
    }
    expect((await load(s)).variants.map((x) => x.stock).sort((a, b) => a - b)).toEqual([3, 5, 7]);
    const ok = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), rows({ "39": "0" }), p.id));
    expect(ok.ok).toBe(true);
    const q = await load(s);
    expect(Object.fromEntries(q.variants.map((x) => [x.size, x.stock]))).toEqual({ "38": 5, "39": 0, "40": 3 });
    const mv = await db.stockMovement.findMany({ where: { variantId: q.variants.find((x) => x.size === "39")!.id }, orderBy: { createdAt: "asc" } });
    expect(mv.map((m) => m.type)).toEqual(["ENTRY", "ADJUSTMENT"]); expect(mv[1].delta).toBe(-7); expect(mv[1].balance).toBe(0);
  });

  it("F: conflito de concorrência (alguém vendeu enquanto editava) não sobrescreve", async () => {
    const s = sku("F2");
    await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [v("M", "Preto", 10)]));
    const p = await load(s); const m = p.variants[0];
    await db.$transaction((tx) => moveStock(tx, { variantId: m.id, delta: -4, type: "SALE", reason: "venda simultânea" }));
    const r = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [{ key: m.id, id: m.id, size: "M", color: "Preto", sku: m.sku, stock: "12", loadedStock: 10, active: true }], p.id));
    expect(r.ok).toBe(false); expect(r.error).toMatch(/mudou/);
    expect((await load(s)).variants[0].stock).toBe(6);
  });

  it("I: sem permissão de estoque não altera quantidades; SKU repetido é recusado", async () => {
    const s = sku("I");
    await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [v("M", "Preto", 10)]));
    const p = await load(s); const m = p.variants[0];
    const row = { key: m.id, id: m.id, size: "M", color: "Preto", sku: m.sku, stock: "99", loadedStock: 10, active: true };
    const r = await persistProduct(PROD_ONLY, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [row], p.id));
    expect(r.ok).toBe(false); expect(r.error).toMatch(/permissão/);
    expect((await load(s)).variants[0].stock).toBe(10);
    // quem só tem products.write ainda cadastra produto novo com estoque inicial e edita dados sem tocar no estoque
    const novo = await persistProduct(PROD_ONLY, input(fields(sku("I2"), cats.camisetas), [v("G", "Preto", 2)]));
    expect(novo.ok).toBe(true);
    const ok = await persistProduct(PROD_ONLY, input(fields(s, cats.camisetas, { status: "PUBLISHED", brand: "Marca X" }), [{ ...row, stock: "10" }], p.id));
    expect(ok.ok).toBe(true);
    // SKU de produto e de variação
    const dupProd = await persistProduct(FULL, input(fields(s, cats.camisetas), [v("M", "Preto", 1)]));
    expect(dupProd.ok).toBe(false); expect(dupProd.fieldErrors?.sku).toBeTruthy();
    const dupVar = await persistProduct(FULL, input(fields(sku("I3"), cats.camisetas), [v("M", "Preto", 1, { sku: m.sku })]));
    expect(dupVar.ok).toBe(false); expect(Object.keys(dupVar.fieldErrors ?? {}).some((k) => k.endsWith(":sku"))).toBe(true);
    expect(await db.product.count({ where: { sku: `${tag}-I3` } })).toBe(0); // nada gravado pela metade
  });

  it("G: produto antigo — editar uma informação preserva tudo; variação existente não é apagada nem reescrita", async () => {
    const s = sku("G");
    const old = await db.product.create({ data: { name: "Legado", slug: `legado-${tag}`, sku: s, priceCents: 5000, status: "PUBLISHED", categoryId: cats.camisetas, variants: { create: [{ sku: `${s}-P-AZUL`, size: "P", color: "Azul", stock: 11 }, { sku: `${s}-M-AZUL`, size: "M", color: "Azul", stock: 4 }] } }, include: { variants: true } });
    // tela envia só uma linha (a outra "não carregou"): a que não veio NÃO é zerada
    const one = old.variants.find((x) => x.size === "P")!;
    const r = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED", price: "59,90" }), [{ key: one.id, id: one.id, size: "P", color: "Azul", sku: one.sku, stock: 11, loadedStock: 11, active: true }], old.id));
    expect(r.ok).toBe(true);
    const q = await load(s);
    expect(q.priceCents).toBe(5990);
    expect(q.variants.map((x) => x.stock).sort((a, b) => a - b)).toEqual([4, 11]);
    // trocar tamanho/cor de variação existente é recusado
    const swap = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [{ key: one.id, id: one.id, size: "G", color: "Azul", sku: one.sku, stock: 11, loadedStock: 11, active: true }], old.id));
    expect(swap.ok).toBe(false);
    // id de outra variação/produto é recusado
    const other = (await load(sku("D"))).variants[0];
    const foreign = await persistProduct(FULL, input(fields(s, cats.camisetas, { status: "PUBLISHED" }), [{ key: "x", id: other.id, size: other.size, color: other.color, sku: other.sku, stock: 1, loadedStock: other.stock, active: true }], old.id));
    expect(foreign.ok).toBe(false);
  });

  it("G: calçado legado sem numeração é identificado: não salva/publica até corrigir, sem apagar histórico", async () => {
    const s = sku("G2");
    const old = await db.product.create({ data: { name: "Tênis antigo", slug: `tenis-antigo-${tag}`, sku: s, priceCents: 9000, status: "PUBLISHED", categoryId: cats.tenis, variants: { create: [{ sku: `${s}-U`, size: "Único", color: "Preto", stock: 3 }] } }, include: { variants: true } });
    const r = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), undefined, old.id));
    expect(r.ok).toBe(false); expect(r.fieldErrors).toBeTruthy();
    const cur = old.variants[0];
    const fix = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "PUBLISHED" }), [
      { key: cur.id, id: cur.id, size: "Único", color: "Preto", sku: cur.sku, stock: 3, loadedStock: 3, active: false }, v("41", "Preto", 3),
    ], old.id));
    expect(fix.ok).toBe(true);
    const q = await load(s);
    expect(q.variants.find((x) => x.size === "Único")!.active).toBe(false); expect(q.variants.find((x) => x.size === "Único")!.stock).toBe(3);
    expect(q.variants.find((x) => x.size === "41")!.active).toBe(true);
    // arquivar nunca fica preso pela regra
    const arch = await persistProduct(FULL, input(fields(s, cats.tenis, { status: "ARCHIVED" }), undefined, old.id));
    expect(arch.ok).toBe(true);
  });

  it("H: produto sem tamanho/cor (relógio e perfume) usa Único e não exige opções", async () => {
    const s = sku("H");
    expect((await persistProduct(FULL, input(fields(s, cats.relogios, { status: "PUBLISHED" }), [v("Único", "Único", 5)]))).ok).toBe(true);
    const p = await load(s);
    expect(p.variants.length).toBe(1); expect(p.variants[0].sku).toBe(`${s}-UN`);
    expect((await persistProduct(FULL, input(fields(sku("H2"), cats.perfumes, { status: "PUBLISHED" }), [v("100ML", "Único", 2), v("50ML", "Único", 4)]))).ok).toBe(true);
    // publicar sem nenhuma variação ativa é recusado; salvar inativo é permitido
    expect((await persistProduct(FULL, input(fields(sku("H3"), cats.relogios, { status: "PUBLISHED" }), []))).ok).toBe(false);
    expect((await persistProduct(FULL, input(fields(sku("H4"), cats.relogios, { status: "DRAFT" }), []))).ok).toBe(true);
  });

  it("categoria inexistente e entradas absurdas são recusadas", async () => {
    expect((await persistProduct(FULL, input(fields(sku("Z1"), "nao-existe"), [v("M", "Preto", 1)]))).ok).toBe(false);
    expect((await persistProduct(FULL, input(fields(sku("Z2"), cats.camisetas, { price: "0" }), [v("M", "Preto", 1)]))).ok).toBe(false);
    expect((await persistProduct(FULL, input(fields(sku("Z3"), cats.camisetas), [v("M", "Preto", "100001")]))).ok).toBe(false);
  });
});
