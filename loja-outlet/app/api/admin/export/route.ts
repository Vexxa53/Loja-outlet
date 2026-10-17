import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";
import { orderFilter } from "@/lib/order-filter";

export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin || !admin.role.permissions.includes("orders.read")) return new NextResponse("Não autorizado", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const orders = await db.order.findMany({ where: orderFilter(sp), orderBy: { createdAt: "desc" }, take: 10000, include: { items: true } });
  const rows: (string | number | null)[][] = [["Numero", "Data", "Cliente", "Email", "Status", "Pagamento", "Itens", "Subtotal", "Desconto", "Frete", "Total", "Cupom", "Rastreio", "UF"]];
  for (const o of orders) rows.push([o.number, o.createdAt.toISOString(), o.customerName, o.email, o.status, o.paymentStatus, o.items.map((i) => `${i.quantity}x ${i.sku}`).join(" | "),
    (o.subtotalCents / 100).toFixed(2), (o.discountCents / 100).toFixed(2), (o.shippingCents / 100).toFixed(2), (o.totalCents / 100).toFixed(2), o.couponCode, o.trackingCode, o.shipState]);
  await audit(admin.id, "orders.export", "Order", null, { count: orders.length });
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pedidos.csv"', "Cache-Control": "no-store" } });
}
