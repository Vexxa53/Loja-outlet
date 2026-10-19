import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Só para o banco de TESTE: zera os contadores de limite de tentativas entre os casos de teste. */
export const clearLimits = async () => { await db.rateLimit.deleteMany(); };
