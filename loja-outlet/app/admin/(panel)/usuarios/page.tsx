import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import { saveAdminUser, saveRole } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("users.write");
  const sp = await searchParams;
  const [users, roles] = await Promise.all([db.adminUser.findMany({ include: { role: true }, orderBy: { createdAt: "asc" } }), db.role.findMany({ orderBy: { label: "asc" } })]);
  const roleSel = (def?: string) => <select name="roleId" aria-label="Perfil" defaultValue={def} className="input">{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>;
  return (
    <div className="space-y-6"><h1 className="h-display text-2xl">Usuários e permissões</h1><Flash ok={sp.ok} erro={sp.erro} />
      <form action={saveAdminUser} className="card grid items-end gap-2 p-3 md:grid-cols-5"><label className="block"><span className="label">Nome</span><input name="name" className="input" required /></label><label className="block"><span className="label">E-mail</span><input name="email" type="email" className="input" required /></label>
        <div><label className="label">Perfil</label>{roleSel()}</div><label className="block"><span className="label">Senha inicial (mín. 10)</span><input name="password" type="password" autoComplete="new-password" className="input" required /></label><button className="btn">Criar usuário</button></form>
      {users.map((u) => (<form key={u.id} action={saveAdminUser} className="card grid items-end gap-2 p-3 md:grid-cols-6"><input type="hidden" name="id" value={u.id} />
        <label className="block"><span className="label">Nome</span><input name="name" defaultValue={u.name} className="input" /></label><label className="block"><span className="label">E-mail</span><input name="email" defaultValue={u.email} className="input" /></label><div><label className="label">Perfil</label>{roleSel(u.roleId)}</div>
        <label className="block"><span className="label">Nova senha (opcional)</span><input name="password" type="password" autoComplete="new-password" className="input" /></label><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Ativo</label><button className="btn btn-ghost">Salvar</button></form>))}
      <h2 className="font-bold uppercase">Permissões por perfil</h2>
      {roles.map((r) => (<form key={r.id} action={saveRole} className="card space-y-2 p-3"><input type="hidden" name="id" value={r.id} /><p className="font-bold">{r.label} {r.name === "admin" && <span className="badge">fixo</span>}</p>
        <div className="grid gap-1 text-sm md:grid-cols-3">{ALL_PERMISSIONS.map((p) => (<label key={p} className="flex items-center gap-2"><input type="checkbox" name="permissions" value={p} defaultChecked={r.permissions.includes(p)} disabled={r.name === "admin"} /> {PERMISSIONS[p]}</label>))}</div>
        {r.name !== "admin" && <button className="btn btn-ghost !py-1.5">Salvar permissões</button>}</form>))}</div>
  );
}
