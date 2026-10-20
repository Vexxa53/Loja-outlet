"use server";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { db } from "@/lib/db";
import { saveGridConfig } from "@/lib/size-grid-config";
import { KINDS, type Kind } from "@/lib/size-grids";

const BACK = "/admin/config/grades";

/** Salva grades sugeridas por tipo e o tipo de cada categoria real. Não altera nenhum produto ou estoque. */
export async function saveGrades(fd: FormData) {
  const admin = await requireAdmin("categories.write");
  const grids: Partial<Record<Kind, string[]>> = {};
  for (const k of KINDS) {
    const raw = String(fd.get(`grid_${k}`) ?? "");
    const list = raw.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (list.length) grids[k] = list;
  }
  const cats = await db.category.findMany({ select: { slug: true } });
  const categoryKinds: Record<string, Kind> = {};
  for (const c of cats) { const v = String(fd.get(`kind_${c.slug}`) ?? ""); if ((KINDS as string[]).includes(v)) categoryKinds[c.slug] = v as Kind; }
  await saveGridConfig({ grids, categoryKinds });
  await audit(admin.id, "size-grids.update", "Setting", "size_grids", { kinds: Object.keys(grids).length });
  go(BACK, "Grades de tamanho salvas.");
}
