import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { deleteCategory, saveCategory } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("categories.write");
  const sp = await searchParams;
  const cats = await db.category.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  const row = (c?: (typeof cats)[number]) => (
    <form action={saveCategory} className="card grid items-end gap-2 p-3 md:grid-cols-[1fr_1fr_80px_auto_auto_auto]" key={c?.id ?? "new"}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className="block"><span className="label">Nome</span><input name="name" defaultValue={c?.name} className="input" required /></label>
      <label className="block"><span className="label">Imagem{c?.imageUrl ? " (já enviada)" : ""}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input" /></label>
      <label className="block"><span className="label">Ordem</span><input name="position" type="number" defaultValue={c?.position ?? 0} className="input" /></label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Ativa</label>
      <button className="btn">{c ? "Salvar" : "Criar"}</button>
      {c && <button formAction={deleteCategory} className="btn btn-danger" formNoValidate>Excluir ({c._count.products})</button>}
    </form>
  );
  return (<div className="space-y-4"><h1 className="h-display text-2xl">Categorias</h1><Flash ok={sp.ok} erro={sp.erro} />{row()}{cats.map((c) => row(c))}</div>);
}
