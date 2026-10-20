import { describe, expect, it } from "vitest";
import { addColor, addSize, counts, fillEmptyStock, initGrid, removeColor, removeSize, rowsToSave, setRow } from "../lib/variant-grid";

describe("matriz tamanho × cor", () => {
  it("4 tamanhos × 3 cores = 12 combinações, sem duplicar ao repetir cliques", () => {
    let g = initGrid([]);
    for (const c of ["Preto", "Branco", "Azul-marinho"]) g = addColor(g, c);
    for (const s of ["37", "38", "39", "40"]) g = addSize(g, s);
    g = addSize(g, "38"); g = addColor(g, "preto");
    expect(g.rows.length).toBe(12);
    expect(counts(g).total).toBe(12);
    expect(new Set(g.rows.map((r) => r.key)).size).toBe(12);
  });
  it("preserva estoque preenchido ao adicionar/remover opções e desativa combinações", () => {
    let g = addColor(addColor(initGrid([]), "Preto"), "Branco");
    g = addSize(addSize(g, "38"), "39");
    g = setRow(g, "n:38|preto", { stock: "5" });
    g = addSize(g, "40");
    expect(g.rows.find((r) => r.key === "n:38|preto")!.stock).toBe("5");
    g = setRow(g, "n:39|branco", { active: false }); // combinação inexistente
    expect(counts(g).active).toBe(5); // 3 tamanhos × 2 cores - 1
    expect(rowsToSave(g).filter((r) => r.active).length).toBe(5);
  });
  it("linhas existentes nunca são apagadas: ao desmarcar viram inativas e mantêm o estoque", () => {
    let g = initGrid([{ id: "v1", size: "38", color: "Preto", sku: "T-38-PRETO", stock: 7, active: true }, { id: "v2", size: "39", color: "Preto", sku: "T-39-PRETO", stock: 3, active: true }]);
    g = removeSize(g, "39");
    const v2 = g.rows.find((r) => r.id === "v2")!;
    expect(v2.active).toBe(false); expect(v2.stock).toBe("3"); expect(v2.loadedStock).toBe(3);
    g = addSize(g, "39"); // volta a marcar: reativa a mesma linha
    expect(g.rows.filter((r) => r.size === "39").length).toBe(1);
    expect(g.rows.find((r) => r.id === "v2")!.active).toBe(true);
    // novas linhas, ao desmarcar, somem
    g = addSize(g, "41"); g = removeSize(g, "41");
    expect(g.rows.some((r) => r.size === "41")).toBe(false);
  });
  it("'Cor única' e cores reais não convivem; sem escolher cor não há combinações", () => {
    let g = addSize(initGrid([]), "M");
    expect(g.rows.length).toBe(0);
    g = addColor(g, "Único");
    expect(g.rows.map((r) => r.color)).toEqual(["Único"]);
    g = addColor(g, "Preto");
    expect(g.colors).toEqual(["Preto"]);
    expect(g.rows.filter((r) => r.active).map((r) => r.color)).toEqual(["Preto"]);
    g = removeColor(g, "Preto");
    expect(g.rows.filter((r) => r.active).length).toBe(0);
  });
  it("preenche só os estoques vazios das linhas novas", () => {
    let g = addSize(addSize(addColor(initGrid([]), "Preto"), "M"), "G");
    g = setRow(g, "n:m|preto", { stock: "2" });
    g = fillEmptyStock(g, "0");
    expect(g.rows.map((r) => r.stock)).toEqual(["2", "0"]);
  });
});
