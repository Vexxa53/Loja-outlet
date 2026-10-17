import type { Prisma } from "@prisma/client";

export const orderFilter = (sp: { q?: string; status?: string; pagamento?: string; de?: string; ate?: string }): Prisma.OrderWhereInput => ({
  ...(sp.status ? { status: sp.status as never } : {}), ...(sp.pagamento ? { paymentStatus: sp.pagamento as never } : {}),
  ...(sp.de || sp.ate ? { createdAt: { ...(sp.de ? { gte: new Date(sp.de + "T00:00:00-03:00") } : {}), ...(sp.ate ? { lte: new Date(sp.ate + "T23:59:59-03:00") } : {}) } } : {}),
  ...(sp.q ? { OR: [...(/^\d+$/.test(sp.q) ? [{ number: Number(sp.q) }] : []), { customerName: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }] } : {}),
});
