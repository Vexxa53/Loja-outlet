import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl, dateBR } from "@/lib/money";
import { SalesChart } from "./SalesChart";

const PAID = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const me = await requireAdmin();
  if (!me.role.permissions.includes("reports.read")) {
    const first = ADMIN_NAV.find(([, , perm]) => perm && me.role.permissions.includes(perm));
    redirect(first ? first[0] : "/admin/sem-permissao");
  }
  const sp = await searchParams;
  const to = sp.ate && !isNaN(Date.parse(sp.ate)) ? new Date(sp.ate + "T23:59:59-03:00") : new Date();
  const from = sp.de && !isNaN(Date.parse(sp.de)) ? new Date(sp.de + "T00:00:00-03:00") : new Date(to.getTime() - 29 * 86400_000);
  const range = { gte: from, lte: to };
  const where = { status: { in: [...PAID] }, createdAt: range };

  const [agg, items, daily, top, low, recent, pending] = await Promise.all([
    db.order.aggregate({ where, _sum: { totalCents: true }, _count: true }),
    db.orderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
    db.$queryRaw<{ day: string; total: bigint; orders: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date, 'DD/MM') AS day, SUM("totalCents") AS total, COUNT(*) AS orders
      FROM "Order" WHERE "status"::text = ANY(${[...PAID]}) AND "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date`,
    db.orderItem.groupBy({ by: ["productName"], where: { order: where }, _sum: { quantity: true, totalCents: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    db.$queryRaw<{ id: string; name: string; size: string; color: string; stock: number; minStock: number }[]>`
      SELECT v."id", p."name", v."size", v."color", v."stock", v."minStock" FROM "Variant" v JOIN "Product" p ON p."id"=v."productId"
      WHERE v."active" AND p."status"='PUBLISHED' AND v."stock" <= v."minStock" ORDER BY v."stock" ASC LIMIT 8`,
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.order.count({ where: { status: "PENDING" } }),
  ]);
  const revenue = agg._sum.totalCents ?? 0;
  const ticket = agg._count ? Math.round(revenue / agg._count) : 0;
  const kpi = (label: string, value: string) => (<div className="card p-4"><p className="label">{label}</p><p className="text-2xl font-extrabold text-accent">{value}</p></div>);
  const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="h-display text-2xl">Dashboard</h1>
        <form className="flex items-end gap-2"><div><label className="label" htmlFor="de">De</label><input id="de" type="date" name="de" defaultValue={iso(from)} className="input" /></div>
          <div><label className="label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" defaultValue={iso(to)} className="input" /></div><button className="btn">Filtrar</button></form></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpi("Faturamento", brl(revenue))}{kpi("Pedidos pagos", String(agg._count))}{kpi("Ticket médio", brl(ticket))}{kpi("Itens vendidos", String(items._sum.quantity ?? 0))}{kpi("Aguardando pagamento", String(pending))}
      </div>
      <div className="card p-4"><p className="label">Vendas por dia (R$)</p>
        {daily.length ? <SalesChart data={daily.map((d) => ({ day: d.day, total: Number(d.total) / 100, orders: Number(d.orders) }))} /> : <p className="py-10 text-center text-mute">Sem vendas no período.</p>}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4"><p className="label">Mais vendidos</p>{top.length ? <ol className="space-y-1 text-sm">{top.map((t) => <li key={t.productName} className="flex justify-between"><span>{t.productName}</span><span>{t._sum.quantity} un · {brl(t._sum.totalCents ?? 0)}</span></li>)}</ol> : <p className="text-mute text-sm">Sem dados.</p>}</div>
        <div className="card p-4"><p className="label">Estoque baixo</p>{low.length ? <ul className="space-y-1 text-sm">{low.map((v) => <li key={v.id} className="flex justify-between"><span>{v.name} ({v.color}/{v.size})</span><span className={v.stock === 0 ? "text-red-400" : "text-accent"}>{v.stock}</span></li>)}</ul> : <p className="text-mute text-sm">Nenhum alerta.</p>}</div>
        <div className="card p-4"><p className="label">Pedidos recentes</p><ul className="space-y-1 text-sm">{recent.map((o) => <li key={o.id} className="flex justify-between"><Link className="underline" href={`/admin/pedidos/${o.id}`}>#{o.number} {o.customerName}</Link><span>{brl(o.totalCents)}</span></li>)}{!recent.length && <p className="text-mute">Nenhum pedido.</p>}</ul>
          <p className="mt-2 text-xs text-mute">Atualizado em {dateBR(new Date())}</p></div>
      </div>
    </div>
  );
}
