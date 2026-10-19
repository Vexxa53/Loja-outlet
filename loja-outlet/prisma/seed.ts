// Cria perfis padrão e categorias (sempre). Com SEED_CATALOG=1 instala também o catálogo inicial de demonstração (35 produtos).
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../lib/permissions";
import { DEFAULT_CATEGORIES } from "../lib/default-categories";
import { installStarterBatch } from "../lib/starter-catalog";

const db = new PrismaClient();

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({
      where: { name: r.name },
      create: { name: r.name, label: r.label, permissions: r.permissions, system: true },
      update: r.name === "admin" ? { permissions: r.permissions, label: r.label } : { label: r.label }, // preserva ajustes feitos no painel
    });
  }
  if ((await db.category.count()) === 0) await db.category.createMany({ data: DEFAULT_CATEGORIES, skipDuplicates: true });
  console.log("Perfis e categorias padrão garantidos.");

  if (process.env.SEED_CATALOG === "1") {
    let offset: number | null = 0;
    let created = 0;
    while (offset !== null) {
      const r = await installStarterBatch({ offset, limit: 10 });
      created += r.created;
      for (const e of r.errors) console.warn(e);
      offset = r.next;
    }
    console.log(`Catálogo inicial: ${created} produto(s) criado(s).`);
  }
}

main().finally(() => db.$disconnect());
