import Link from "next/link";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { brl, dateBR } from "@/lib/money";

export const metadata = { title: "Meus pedidos" };

export default async function Page() {
  const c = await requireCustomer();
  const orders = await db.order.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "desc" } });
  return (<div className="container-x max-w-3xl py-10"><h1 className="h-display mb-4 text-3xl">Meus pedidos</h1>
    {orders.length ? <table className="tbl card"><tbody>{orders.map((o) => (<tr key={o.id}><td><Link className="underline" href={`/pedido/${o.id}`}>#{o.number}</Link></td><td>{dateBR(o.createdAt)}</td><td><span className="badge">{o.status}</span></td><td className="text-right">{brl(o.totalCents)}</td></tr>))}</tbody></table> : <p className="text-mute">Você ainda não fez pedidos.</p>}</div>);
}
