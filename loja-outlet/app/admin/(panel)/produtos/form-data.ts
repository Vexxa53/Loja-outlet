import { db } from "@/lib/db";
import { loadGridConfig } from "@/lib/size-grid-config";
import { gridFor, KINDS, kindFor, type Kind } from "@/lib/size-grids";

/** Categorias REAIS do banco + tipo de grade de cada uma (configuração central) + grades sugeridas. */
export async function productFormData() {
  const [cats, cfg] = await Promise.all([db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, slug: true } }), loadGridConfig()]);
  const categories = cats.map((c) => ({ id: c.id, name: c.name, kind: kindFor(c, cfg) }));
  const grids = Object.fromEntries(KINDS.map((k) => [k, gridFor(k, cfg)])) as Record<Kind, string[]>;
  return { categories, grids };
}
