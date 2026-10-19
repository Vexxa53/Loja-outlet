import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { deleteBanner, moveBanner, toggleBanner } from "@/app/actions/admin-misc";
import { BannerForm } from "./BannerForm";

const DEVICE: Record<string, string> = { all: "Computador e celular", desktop: "Só computador", mobile: "Só celular" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("content.write");
  const sp = await searchParams;
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] });
  const groups = [["hero", "Carrossel principal"], ["secondary", "Banners menores"]] as const;
  return (
    <div className="space-y-6">
      <h1 className="h-display text-2xl">Banners</h1>
      <Flash ok={sp.ok} erro={sp.erro} />
      <section className="card p-4"><h2 className="mb-3 font-bold uppercase">Novo banner</h2><BannerForm /></section>
      {groups.map(([key, title]) => {
        const list = banners.filter((b) => b.placement === key);
        return (
          <section key={key} className="space-y-3">
            <h2 className="font-bold uppercase">{title} <span className="text-sm font-normal text-mute">({list.length})</span></h2>
            {!list.length && <p className="card p-4 text-sm text-mute">Nenhum banner aqui. {key === "hero" ? "Enquanto não houver banner ativo, a loja mostra slides padrão em preto e amarelo." : "A faixa só aparece quando houver banners ativos."}</p>}
            {list.map((b) => (
              <details key={b.id} className="card">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt="" className="h-14 w-24 object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1"><strong className="block truncate">{b.title}</strong><span className="text-xs text-mute">{DEVICE[b.device]} · ordem {b.position}</span></span>
                  <span className={`badge ${b.active ? "badge-accent" : ""}`}>{b.active ? "Ativo" : "Desativado"}</span>
                </summary>
                <div className="space-y-4 border-t border-steel p-3">
                  <div className="flex flex-wrap gap-2">
                    <form action={moveBanner} className="flex gap-1"><input type="hidden" name="id" value={b.id} /><button name="dir" value="up" className="btn btn-ghost" aria-label="Subir na ordem">↑ Subir</button><button name="dir" value="down" className="btn btn-ghost" aria-label="Descer na ordem">↓ Descer</button></form>
                    <form action={toggleBanner}><input type="hidden" name="id" value={b.id} /><SubmitButton className="btn btn-ghost" pendingText="...">{b.active ? "Desativar" : "Ativar"}</SubmitButton></form>
                    <form action={deleteBanner}><input type="hidden" name="id" value={b.id} /><ConfirmButton message={`Excluir o banner "${b.title}"? Esta ação não pode ser desfeita.`}>Excluir</ConfirmButton></form>
                  </div>
                  <BannerForm banner={b} />
                </div>
              </details>
            ))}
          </section>
        );
      })}
    </div>
  );
}
