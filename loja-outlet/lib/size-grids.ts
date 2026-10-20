import { slugify } from "./slug";
import { COLOR_HEX } from "./nav";

/**
 * Configuração CENTRAL de grades de tamanho (sem acesso a banco: serve ao servidor e ao navegador).
 * Quais categorias exigem numeração e quais grades são sugeridas se define aqui — e o administrador
 * pode ampliar em Configurações → Grades de tamanho (gravado em Setting "size_grids").
 */
export type Kind = "calcado" | "camiseta" | "blusa" | "calca" | "relogio" | "oculos" | "outros";
export const KINDS: Kind[] = ["calcado", "camiseta", "blusa", "calca", "relogio", "oculos", "outros"];

export const KIND_LABEL: Record<Kind, string> = {
  calcado: "Calçados (exige numeração)", camiseta: "Camisetas e camisas", blusa: "Blusas e moletons", calca: "Calças",
  relogio: "Relógios", oculos: "Óculos", outros: "Outras categorias",
};

export const UNIQUE_SIZE = "Único";
export const UNIQUE_COLOR = "Único";

export const DEFAULT_GRIDS: Record<Kind, string[]> = {
  calcado: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
  camiseta: ["PP", "P", "M", "G", "GG", "XGG"],
  blusa: ["PP", "P", "M", "G", "GG", "XGG"],
  calca: ["36", "38", "40", "42", "44", "46", "48"],
  relogio: [],
  oculos: [],
  outros: [],
};

export type KindRule = { requiresNumericSize: boolean; allowsSingle: boolean };
export const KIND_RULES: Record<Kind, KindRule> = {
  calcado: { requiresNumericSize: true, allowsSingle: false },
  camiseta: { requiresNumericSize: false, allowsSingle: true },
  blusa: { requiresNumericSize: false, allowsSingle: true },
  calca: { requiresNumericSize: false, allowsSingle: true },
  relogio: { requiresNumericSize: false, allowsSingle: true },
  oculos: { requiresNumericSize: false, allowsSingle: true },
  outros: { requiresNumericSize: false, allowsSingle: true },
};

export type GridConfig = { grids: Partial<Record<Kind, string[]>>; categoryKinds: Record<string, Kind> };
export const EMPTY_GRID_CONFIG: GridConfig = { grids: {}, categoryKinds: {} };

const norm = (s: string) => slugify(s);
const SHOE = /(tenis|sapat|bota|sandal|chinel|calcad|mocassim|chuteira|sapatilha|rasteir|alpercat)/;

/** Sugestão de tipo a partir da categoria real (slug/nome), sem depender do nome digitado no produto. */
export function guessKind(cat: { slug: string; name: string }): Kind {
  const t = `${norm(cat.slug)} ${norm(cat.name)}`;
  if (SHOE.test(t)) return "calcado";
  if (/oculos/.test(t)) return "oculos";
  if (/relogio/.test(t)) return "relogio";
  if (/(blusa|jaqueta|moletom|casaco|agasalho)/.test(t)) return "blusa";
  if (/(camiseta|camisa|polo|regata)/.test(t)) return "camiseta";
  if (/(calca|bermuda|short|jeans)/.test(t)) return "calca";
  return "outros";
}

/** Tipo efetivo: ajuste do administrador (por slug da categoria) ou a sugestão. */
export function kindFor(cat: { slug: string; name: string } | null | undefined, cfg: GridConfig = EMPTY_GRID_CONFIG): Kind {
  if (!cat) return "outros";
  return cfg.categoryKinds[cat.slug] ?? guessKind(cat);
}

export function gridFor(kind: Kind, cfg: GridConfig = EMPTY_GRID_CONFIG): string[] {
  const extra = cfg.grids[kind];
  return extra && extra.length ? extra : DEFAULT_GRIDS[kind];
}

export function normalizeSize(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").replace(",", ".");
  return /^[uú]nic[oa]$/i.test(t) ? UNIQUE_SIZE : t.toUpperCase();
}
export const normalizeColor = (raw: string) => {
  const c = raw.trim().replace(/\s+/g, " ");
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : c;
};
/** Número válido de calçado: inteiro ou meio número (37, 37.5), de 15 a 60. */
export function isNumericSize(size: string): boolean {
  if (!/^\d{2}(\.5)?$/.test(size)) return false;
  const n = Number(size);
  return n >= 15 && n <= 60;
}

export const variantKey = (size: string, color: string) => `${size.toLowerCase()}|${color.toLowerCase()}`;

/** SKU sugerido: REF-TAMANHO-COR (sem acentos/espaços); "Único" não entra no código. */
export function makeSku(productSku: string, size: string, color: string): string {
  const parts = [productSku.toUpperCase(), size === UNIQUE_SIZE ? "UN" : slugify(size), color === UNIQUE_COLOR ? "" : slugify(color)].filter(Boolean);
  return parts.join("-").toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 60);
}

/** Cores sugeridas = catálogo de cores já usado pela vitrine (nav.COLOR_HEX), com iniciais maiúsculas. */
export const COLOR_PRESETS: string[] = Object.keys(COLOR_HEX).filter((k) => k !== "estampada").map((k) => k.charAt(0).toUpperCase() + k.slice(1));
