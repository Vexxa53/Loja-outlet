import { slugify } from "./slug";

// Mesmas 5 categorias do catálogo inicial (slugs idênticos) + 2 linhas extras da loja, que só aparecem na vitrine quando tiverem produtos.
export const DEFAULT_CATEGORIES = [
  "Camisas",
  "Calças",
  "Tênis",
  "Blusas e jaquetas",
  "Relógios",
  "Acessórios",
  "Perfumes",
].map((name, i) => ({ name, slug: slugify(name), position: i + 1 }));
