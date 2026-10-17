import { db } from "./db";
import type { Prisma } from "@prisma/client";

const SENSITIVE = /pass|senha|token|secret|card|cartao/i;

function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SENSITIVE.test(k) ? "[omitido]" : scrub(x)]),
    );
  }
  return v;
}

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: unknown,
) {
  await db.auditLog.create({
    data: { userId, action, entity, entityId: entityId ?? null, details: scrub(details) as Prisma.InputJsonValue },
  });
}
