import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl, dateBR } from "@/lib/money";
import { Flash } from "@/components/Flash";
import { resolvePrivacy } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; erro?: string }> }) {
  await requireAdmin("customers.read");
  const sp = await searchParams;
  const customers = await db.customer.findMany({ where: sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }] } : undefined, orderBy: { createdAt: "desc" }, take: 200,
    include: { orders: { where: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, select: { totalCents: true } }, _count: { select: { orders: true } } } });
  const [newsCount, news] = await Promise.all([db.newsletterSignup.count(), db.newsletterSignup.findMany({ orderBy: { createdAt: "desc" }, take: 20 })]);
  const reqs = await db.privacyRequest.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Clientes</h1><Flash ok={sp.ok} erro={sp.erro} />
      {reqs.length > 0 && (<div className="card space-y-2 p-4"><p className="label">Solicitações de privacidade (LGPD) em aberto</p>
        {reqs.map((r) => (<form key={r.id} action={resolvePrivacy} className="flex flex-wrap items-center gap-3 text-sm"><input type="hidden" name="id" value={r.id} /><span className="badge badge-accent">{r.kind}</span><span>{r.email} · {dateBR(r.createdAt)} · {r.note}</span>
          {r.kind === "DELETE" && <label className="flex items-center gap-1"><input type="checkbox" name="confirm" /> confirmo anonimizar</label>}<button className="btn btn-ghost !py-1">Resolver</button></form>))}</div>)}
      <details className="card p-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between font-bold uppercase">Newsletter <span className="badge">{newsCount} cadastro(s)</span></summary>
        <div className="space-y-2 pt-2 text-sm"><p className="text-mute">E-mails cadastrados no site, com consentimento registrado. Use somente para o envio de novidades e respeite os pedidos de descadastro.</p>
          {newsCount > 0 && <a className="btn btn-ghost" href="/api/admin/export-newsletter">Exportar CSV</a>}
          <ul className="divide-y divide-steel">{news.map((n) => <li key={n.id} className="flex justify-between gap-2 py-2"><span className="truncate">{n.email}</span><span className="shrink-0 text-xs text-mute">{dateBR(n.consentAt)}</span></li>)}</ul></div></details>
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Nome ou e-mail" className="input max-w-xs" /><button className="btn btn-ghost">Buscar</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Cliente</th><th>Cadastro</th><th>Pedidos</th><th>Total comprado</th></tr></thead><tbody>
        {customers.map((c) => (<tr key={c.id}><td><Link className="underline" href={`/admin/clientes/${c.id}`}>{c.name}</Link><br /><span className="text-xs text-mute">{c.email}</span></td><td>{dateBR(c.createdAt)}</td><td>{c._count.orders}</td><td>{brl(c.orders.reduce((s, o) => s + o.totalCents, 0))}</td></tr>))}</tbody></table></div></div>
  );
}
