"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBannerAction } from "@/app/actions/admin-misc";
import { ImageField, type Img } from "@/components/admin/ImageField";

type B = {
  id: string; title: string; subtitle: string | null; ctaLabel: string | null; link: string | null; placement: string; device: string; active: boolean;
  imageUrl: string; imagePath: string | null; mobileImageUrl: string | null; mobileImagePath: string | null;
};

export function BannerForm({ banner, onDone }: { banner?: B; onDone?: () => void }) {
  const router = useRouter();
  const [desktop, setDesktop] = useState<Img>(banner ? { url: banner.imageUrl, path: banner.imagePath ?? "" } : null);
  const [mobile, setMobile] = useState<Img>(banner?.mobileImageUrl ? { url: banner.mobileImageUrl, path: banner.mobileImagePath ?? "" } : null);
  const [placement, setPlacement] = useState(banner?.placement ?? "hero");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("imageUrl", desktop?.url ?? ""); fd.set("imagePath", desktop?.path ?? "");
    fd.set("mobileImageUrl", mobile?.url ?? ""); fd.set("mobileImagePath", mobile?.path ?? "");
    setPending(true);
    const r = await saveBannerAction(fd);
    setPending(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? "Não foi possível salvar." }); return; }
    setMsg({ ok: true, text: banner ? "Banner atualizado. A loja já mostra a alteração." : "Banner publicado!" });
    if (!banner) { setDesktop(null); setMobile(null); (e.target as HTMLFormElement).reset(); }
    router.refresh();
    onDone?.();
  }

  const hero = placement === "hero";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <ImageField label={hero ? "Imagem do computador (recomendado 1920×800)" : "Imagem (recomendado 1600×1000)"} kind="banner" value={desktop} onChange={setDesktop}
          aspect={hero ? "aspect-[12/5]" : "aspect-[16/10]"} hint="JPG, PNG ou WebP, até 4 MB. Deixe a esquerda mais livre: o título aparece ali." />
        <ImageField label="Imagem do celular — opcional (recomendado 900×1100)" kind="banner" value={mobile} onChange={setMobile} aspect="aspect-[9/11]"
          hint="Se não enviar, o celular usa a imagem do computador." />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block"><span className="label">Título</span><input name="title" defaultValue={banner?.title} className="input" required /></label>
        <label className="block"><span className="label">Texto (subtítulo) — opcional</span><input name="subtitle" defaultValue={banner?.subtitle ?? ""} className="input" /></label>
        <label className="block"><span className="label">Texto do botão — opcional</span><input name="ctaLabel" defaultValue={banner?.ctaLabel ?? ""} className="input" placeholder="Comprar agora" /></label>
        <label className="block"><span className="label">Link de destino — opcional</span><input name="link" defaultValue={banner?.link ?? ""} className="input" placeholder="/produtos?categoria=tenis" /></label>
        <label className="block"><span className="label">Onde aparece na página</span>
          <select name="placement" value={placement} onChange={(e) => setPlacement(e.target.value)} className="input"><option value="hero">Carrossel principal</option><option value="secondary">Faixa de banners menores</option></select></label>
        <label className="block"><span className="label">Exibir em</span>
          <select name="device" defaultValue={banner?.device ?? "all"} className="input"><option value="all">Computador e celular</option><option value="desktop">Só computador</option><option value="mobile">Só celular</option></select></label>
      </div>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={banner?.active ?? true} className="h-5 w-5" /> Ativo (aparece na loja)</label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text}</p>}
      <button className="btn w-full sm:w-auto" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : banner ? "Salvar banner" : "Publicar banner"}</button>
    </form>
  );
}
