import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { loadGridConfig } from "@/lib/size-grid-config";
import { DEFAULT_GRIDS, gridFor, guessKind, KIND_LABEL, KINDS, kindFor } from "@/lib/size-grids";
import { saveGrades } from "@/app/actions/admin-grades";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("categories.write");
  const sp = await searchParams;
  const [cfg, cats] = await Promise.all([loadGridConfig(), db.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, name: true } })]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="h-display text-2xl">Grades de tamanho</h1><Link href="/admin/config" className="btn btn-ghost">← Configurações</Link></div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <form action={saveGrades} className="card space-y-5 p-4">
        <section className="space-y-3"><h2 className="font-bold uppercase">Qual tipo é cada categoria</h2>
          <p className="text-xs text-mute">Só categorias do tipo <strong>Calçados</strong> exigem numeração. A sugestão automática usa o nome da categoria; ajuste aqui se precisar. Nada é alterado nos produtos já cadastrados.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {cats.map((c) => (
              <div key={c.slug}><label className="label" htmlFor={`kind_${c.slug}`}>{c.name}</label>
                <select id={`kind_${c.slug}`} name={`kind_${c.slug}`} defaultValue={kindFor(c, cfg)} className="input">
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}{k === guessKind(c) ? " — sugerido" : ""}</option>)}</select></div>
            ))}
          </div>
        </section>
        <section className="space-y-3"><h2 className="font-bold uppercase">Tamanhos sugeridos por tipo</h2>
          <p className="text-xs text-mute">Separe por vírgula. Aparecem como botões no cadastro; no cadastro também dá para adicionar tamanhos avulsos. Calçados aceitam só números (ex.: 33, 37.5). Deixe vazio para voltar ao padrão.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {KINDS.map((k) => (
              <div key={k}><label className="label" htmlFor={`grid_${k}`}>{KIND_LABEL[k]}</label>
                <input id={`grid_${k}`} name={`grid_${k}`} defaultValue={cfg.grids[k]?.join(", ") ?? ""} placeholder={(DEFAULT_GRIDS[k].join(", ") || "(tamanho único)")} className="input" />
                <p className="mt-1 text-xs text-mute">Em uso: {gridFor(k, cfg).join(", ") || "—"}</p></div>
            ))}
          </div>
        </section>
        <button className="btn">Salvar grades</button>
      </form>
    </div>
  );
}
