// Departamentos do menu (estilo loja de moda): agrupam as categorias cadastradas pelo slug.
export type Department = { key: string; label: string; slugs: string[] };

export const DEPARTMENTS: Department[] = [
  { key: "roupas", label: "Roupas", slugs: ["camisas", "calcas", "blusas-e-jaquetas"] },
  { key: "calcados", label: "Calçados", slugs: ["tenis"] },
  { key: "acessorios", label: "Acessórios", slugs: ["relogios", "acessorios", "perfumes"] },
];

export type NavCategory = { id: string; name: string; slug: string; image: string | null; count: number };
export type NavDepartment = { key: string; label: string; categories: NavCategory[]; image: string | null };

/** Distribui as categorias (que têm produtos) nos departamentos; categorias novas vão para "Mais". */
export function groupCategories(categories: NavCategory[]): NavDepartment[] {
  const used = new Set<string>();
  const out: NavDepartment[] = DEPARTMENTS.map((d) => {
    const cats = d.slugs.map((s) => categories.find((c) => c.slug === s)).filter((c): c is NavCategory => !!c);
    cats.forEach((c) => used.add(c.slug));
    return { key: d.key, label: d.label, categories: cats, image: cats.find((c) => c.image)?.image ?? null };
  });
  const rest = categories.filter((c) => !used.has(c.slug));
  if (rest.length) out.push({ key: "mais", label: "Mais", categories: rest, image: rest.find((c) => c.image)?.image ?? null });
  return out.filter((d) => d.categories.length > 0);
}

/** Cores comuns em moda → tom para as bolinhas do filtro. */
export const COLOR_HEX: Record<string, string> = {
  preto: "#111111", branco: "#f5f5f5", cinza: "#8a8d93", grafite: "#3a3d44", azul: "#2f5fa7", "azul claro": "#9cc3ea", "azul médio": "#3b6db3",
  "azul-marinho": "#1b2a4a", "azul-petróleo": "#14566b", vermelho: "#c62828", verde: "#2e7d32", "verde oliva": "#6b6b2f", bege: "#d8c3a0",
  cáqui: "#b8a46a", cru: "#e8e0cc", creme: "#efe3c8", caramelo: "#b8722f", taupe: "#8c7b6e", marrom: "#6b4423", amarelo: "#f2c200",
  prata: "#c0c4c9", rosé: "#e6b8a8", laranja: "#e67e22", estampada: "linear-gradient(135deg,#f2c200,#2f5fa7,#c62828)",
};
export function colorStyle(name: string): string {
  const first = name.toLowerCase().split(" e ")[0].trim();
  return COLOR_HEX[name.toLowerCase()] ?? COLOR_HEX[first] ?? "#555";
}

/** Ordena tamanhos: letras (PP…XG) e números (36…48) em ordem natural. */
export function sortSizes(sizes: string[]): string[] {
  const letters = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
  const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);
  return [...sizes].sort((a, b) => {
    const na = num(a), nb = num(b);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return 1;
    if (nb !== null) return -1;
    const ia = letters.indexOf(a), ib = letters.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}
