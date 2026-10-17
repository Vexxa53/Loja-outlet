import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdmin, requireAdmin } from "@/lib/auth";
import { brl, dateBR } from "@/lib/money";
import { Flash } from "@/components/Flash";
import { updateCustomer } from "@/app/actions/admin-misc";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("customers.read");
  const canWrite = (await getAdmin())!.role.permissions.includes("customers.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await db.customer.findUnique({ where: { id }, include: { orders: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">{c.name}</h1><Flash ok={sp.ok} erro={sp.erro} /><p className="text-sm text-mute">{c.email}</p>
      {canWrite && <form action={updateCustomer} className="card grid gap-3 p-4 md:grid-cols-3"><input type="hidden" name="id" value={c.id} /><label className="block"><span className="label">Nome</span><input name="name" defaultValue={c.name} className="input" /></label><label className="block"><span className="label">Telefone</span><input name="phone" defaultValue={c.phone ?? ""} className="input" /></label><div className="flex items-end"><button className="btn">Salvar</button></div></form>}
      <div className="card overflow-x-auto"><table className="tbl"><tbody>{c.orders.map((o) => (<tr key={o.id}><td><Link className="underline" href={`/admin/pedidos/${o.id}`}>#{o.number}</Link></td><td>{dateBR(o.createdAt)}</td><td>{o.status}</td><td>{brl(o.totalCents)}</td></tr>))}</tbody></table></div></div>
  );
}
