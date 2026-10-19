import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Só para o banco de TESTE: zera os contadores de limite de tentativas entre os casos de teste. */
export const clearLimits = async () => { await db.rateLimit.deleteMany(); };

/** Garante o que os testes precisam no banco de TESTE: catálogo inicial instalado (via seed) e um cupom de 10%. */
export async function ensureTestData() {
  await db.coupon.upsert({ where: { code: "BEMVINDO10" }, update: { active: true }, create: { code: "BEMVINDO10", type: "PERCENT", value: 10 } });
}

/** Remove o catálogo inicial do banco de TESTE para começar o teste do zero. */
export async function resetStarterCatalog() {
  await db.product.deleteMany({ where: { sku: { startsWith: "OUT3K-" } } });
}
