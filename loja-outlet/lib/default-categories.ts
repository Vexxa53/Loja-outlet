import { slugify } from "./slug";

export const DEFAULT_CATEGORIES = [
  "Camisetas de grife",
  "Tênis",
  "Calças",
  "Relógios",
  "Acessórios",
  "Perfumes",
].map((name, i) => ({ name, slug: slugify(name), position: i + 1 }));
