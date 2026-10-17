import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { deleteBanner, saveBanner } from "@/app/actions/admin-misc";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("content.write");
  const sp = await searchParams;
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] });
  const form = (b?: (typeof banners)[number]) => (
    <form key={b?.id ?? "new"} action={saveBanner} className="card grid items-end gap-2 p-3 md:grid-cols-4">
      {b && <input type="hidden" name="id" value={b.id} />}
      <label className="block"><span className="label">Título</span><input name="title" defaultValue={b?.title} className="input" required /></label>
      <label className="block"><span className="label">Subtítulo</span><input name="subtitle" defaultValue={b?.subtitle ?? ""} className="input" /></label>
      <label className="block"><span className="label">Botão</span><input name="ctaLabel" defaultValue={b?.ctaLabel ?? ""} className="input" /></label>
      <label className="block"><span className="label">Link</span><input name="link" defaultValue={b?.link ?? ""} className="input" /></label>
      <label className="block"><span className="label">Posição</span><select name="placement" defaultValue={b?.placement ?? "hero"} className="input"><option value="hero">Principal</option><option value="secondary">Secundário</option></select></label>
      <label className="block"><span className="label">Ordem</span><input name="position" type="number" defaultValue={b?.position ?? 0} className="input" /></label>
      <label className="block"><span className="label">{b ? "Substituir imagem" : "Imagem"}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input" /></label>
      <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} /> Ativo</label><button className="btn">Salvar</button>{b && <button formAction={deleteBanner} formNoValidate className="btn btn-danger">Excluir</button>}</div>
      {b &&   <img src={b.imageUrl} alt="" className="h-16 object-cover md:col-span-4" />}
    </form>
  );
  return (<div className="space-y-4"><h1 className="h-display text-2xl">Banners</h1><Flash ok={sp.ok} erro={sp.erro} />{form()}{banners.map((b) => form(b))}</div>);
}
