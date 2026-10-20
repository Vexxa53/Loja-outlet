import { db } from "./db";
import { EMPTY_GRID_CONFIG, isNumericSize, KINDS, normalizeSize, type GridConfig, type Kind } from "./size-grids";

const KEY = "size_grids";

/** Ajustes do administrador (Configurações → Grades de tamanho). Sem ajuste, valem os padrões de lib/size-grids.ts. */
export function sanitizeGridConfig(raw: unknown): GridConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as { grids?: Record<string, unknown>; categoryKinds?: Record<string, unknown> };
  const grids: GridConfig["grids"] = {};
  for (const k of KINDS) {
    const list = v.grids?.[k];
    if (!Array.isArray(list)) continue;
    let sizes = [...new Set(list.map((x) => normalizeSize(String(x))).filter((x) => x && x.length <= 12))].slice(0, 60);
    if (k === "calcado") sizes = sizes.filter(isNumericSize); // calçado só aceita numeração
    if (sizes.length) grids[k] = sizes;
  }
  const categoryKinds: Record<string, Kind> = {};
  for (const [slug, kind] of Object.entries(v.categoryKinds ?? {})) if ((KINDS as string[]).includes(String(kind)) && /^[a-z0-9-]{1,80}$/.test(slug)) categoryKinds[slug] = kind as Kind;
  return { grids, categoryKinds };
}

export async function loadGridConfig(): Promise<GridConfig> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return row ? sanitizeGridConfig(row.value) : EMPTY_GRID_CONFIG;
}

export async function saveGridConfig(cfg: GridConfig) {
  const clean = sanitizeGridConfig(cfg);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: clean as never }, update: { value: clean as never } });
  return clean;
}
