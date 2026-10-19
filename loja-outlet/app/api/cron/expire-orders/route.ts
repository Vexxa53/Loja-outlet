import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { changeOrderStatus } from "@/lib/orders";
import { expireDuePayments } from "@/lib/payments/service";

/** Cancela pedidos sem pagamento há mais de 48h e repõe o estoque. Chamado pelo Vercel Cron (CRON_SECRET). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("forbidden", { status: 403 });
  const expiredPayments = await expireDuePayments();
  const old = await db.order.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 48 * 3600_000) } }, select: { id: true }, take: 200 });
  let n = 0;
  for (const o of old) { try { await changeOrderStatus(o.id, "CANCELLED", "sistema", "Expirado sem pagamento (48h)"); n++; } catch { /* segue */ } }
  return NextResponse.json({ cancelled: n, expiredPayments });
}
