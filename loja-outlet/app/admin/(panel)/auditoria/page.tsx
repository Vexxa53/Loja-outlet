import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateBR } from "@/lib/money";

export default async function Page({ searchParams }: { searchParams: Promise<{ entidade?: string }> }) {
  await requireAdmin("audit.read");
  const sp = await searchParams;
  const logs = await db.auditLog.findMany({ where: sp.entidade ? { entity: sp.entidade } : undefined, orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { name: true, email: true } } } });
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Auditoria</h1>
      <form className="flex gap-2"><select name="entidade" defaultValue={sp.entidade ?? ""} className="input max-w-xs"><option value="">Todas as entidades</option>{["Product", "Variant", "Order", "Coupon", "Setting", "AdminUser", "Role", "Customer", "Banner", "Category"].map((e) => <option key={e}>{e}</option>)}</select><button className="btn btn-ghost">Filtrar</button></form>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>
        {logs.map((l) => (<tr key={l.id}><td>{dateBR(l.createdAt)}</td><td>{l.user?.name ?? "—"}</td><td>{l.action}</td><td>{l.entity} {l.entityId?.slice(-6)}</td><td className="max-w-md break-words text-xs text-mute">{l.details ? JSON.stringify(l.details) : ""}</td></tr>))}</tbody></table></div></div>
  );
}
