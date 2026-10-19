import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

/**
 * Cache de dados que mudam pouco (configurações, menu de categorias) e eram relidos do banco em TODA navegação.
 * Vale por `revalidate` segundos e é limpo na hora quando o painel altera algo (bustStore).
 * Fora do Next (testes/scripts) executa direto, sem cache.
 */
export function cached<A extends unknown[], R>(fn: (...a: A) => Promise<R>, keyParts: string[], opts: { tags: string[]; revalidate: number }) {
  const c = unstable_cache(fn, keyParts, opts);
  return async (...a: A): Promise<R> => {
    try { return await c(...a); }
    catch (e) {
      if (e instanceof Error && /incrementalCache|static generation store|workStore/i.test(e.message)) return fn(...a);
      throw e;
    }
  };
}

export const TAG_SETTINGS = "settings";
export const TAG_CATALOG = "catalog";

/** Chamar depois de qualquer alteração feita no painel que apareça na vitrine. */
export function bustStore() {
  try { revalidateTag(TAG_SETTINGS, { expire: 0 }); revalidateTag(TAG_CATALOG, { expire: 0 }); } catch { /* fora do Next */ }
  revalidatePath("/", "layout");
}
