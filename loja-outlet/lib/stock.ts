import type { MovementType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Ajuste atômico de estoque. Nunca deixa o saldo negativo (condição na própria UPDATE). */
export async function moveStock(
  tx: Tx,
  p: { variantId: string; delta: number; type: MovementType; reason: string; userId?: string | null; orderId?: string | null },
): Promise<number> {
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "Variant" SET "stock" = "stock" + ${p.delta}
    WHERE "id" = ${p.variantId} AND "stock" + ${p.delta} >= 0
    RETURNING "stock"`;
  if (rows.length === 0) throw new StockError("Estoque insuficiente.");
  const balance = rows[0].stock;
  await tx.stockMovement.create({
    data: {
      variantId: p.variantId,
      type: p.type,
      delta: p.delta,
      balance,
      reason: p.reason,
      userId: p.userId ?? null,
      orderId: p.orderId ?? null,
    },
  });
  return balance;
}

export class StockError extends Error {}
