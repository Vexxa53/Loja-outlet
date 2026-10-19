import type { CatalogQuery } from "./catalog";

/** Monta a query string da listagem trocando/removendo parâmetros (e voltando à página 1 quando o filtro muda). */
export function qs(sp: CatalogQuery, change: Partial<Record<keyof CatalogQuery, string | undefined>> = {}): string {
  const merged: Record<string, string | undefined> = { ...sp, ...change };
  if (!("pagina" in change)) merged.pagina = undefined;
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `/produtos?${s}` : "/produtos";
}

export const SORTS: [string, string][] = [
  ["", "Mais relevantes"], ["recentes", "Lançamentos"], ["vendidos", "Mais vendidos"], ["menor", "Menor preço"], ["maior", "Maior preço"], ["desconto", "Maior desconto"],
];

export const PRICE_BANDS: { label: string; min?: string; max?: string }[] = [
  { label: "Até R$ 100", max: "100" }, { label: "R$ 100 a R$ 200", min: "100", max: "200" }, { label: "R$ 200 a R$ 300", min: "200", max: "300" }, { label: "Acima de R$ 300", min: "300" },
];

export const CATEGORY_INTRO: Record<string, string> = {
  camisas: "Camisas, camisetas e polos masculinas para o trabalho, o dia a dia e o fim de semana.",
  calcas: "Jeans, alfaiataria, cargo, jogger e mais: calças masculinas em vários cortes e tons.",
  tenis: "Tênis casuais, esportivos e de estilo urbano, em diferentes numerações.",
  "blusas-e-jaquetas": "Moletons, blusas e jaquetas masculinas para todas as estações.",
  relogios: "Relógios masculinos de estilo casual, esportivo e clássico.",
};
