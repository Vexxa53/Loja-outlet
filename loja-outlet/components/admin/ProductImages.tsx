"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { moveImage, removeImage } from "@/app/actions/admin-products";
import { ConfirmButton } from "./ConfirmButton";
import { checkFile, uploadFile } from "./upload-client";

export type GalleryImage = { id: string; url: string };
type Staged = { key: string; file: File; preview: string; error?: string };
type Busy = { label: string; pct: number };

/**
 * Galeria do produto.
 *  - Produto já salvo (productId): cada arquivo é enviado na hora, com progresso, e entra na galeria.
 *  - Produto novo (sem productId): os arquivos ficam na lista (com prévia) e o formulário os envia depois de salvar.
 */
export function ProductImages({ productId, images, staged = [], onStage }: {
  productId?: string; images: GalleryImage[]; staged?: Staged[]; onStage?: (next: Staged[]) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(files: File[], replace?: string) {
    setMsg(null);
    if (!files.length) return;
    if (!productId) {
      const next = [...staged];
      for (const f of files.slice(0, 8)) {
        const err = checkFile(f);
        next.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, preview: URL.createObjectURL(f), error: err ?? undefined });
      }
      onStage?.(next);
      return;
    }
    let okCount = 0;
    for (const f of files.slice(0, 8)) {
      const bad = checkFile(f);
      if (bad) { setMsg({ ok: false, text: bad }); continue; }
      setBusy({ label: f.name, pct: 0 });
      const r = await uploadFile(f, { kind: "product", productId, ...(replace ? { replaceId: replace } : {}) }, (pct) => setBusy({ label: f.name, pct }));
      if (!r.ok) { setMsg({ ok: false, text: r.error }); break; }
      okCount++;
    }
    setBusy(null);
    if (okCount) { setMsg({ ok: true, text: replace ? "Imagem substituída." : `${okCount} imagem(ns) enviada(s) com sucesso.` }); router.refresh(); }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void handle([...e.dataTransfer.files]); }}
        className={`grid min-h-28 place-items-center border-2 border-dashed p-4 text-center ${drag ? "border-accent bg-steel" : "border-line bg-ink"}`}
      >
        <div>
          <p className="text-sm text-mute">Arraste as fotos aqui ou</p>
          <button type="button" className="btn mt-2" disabled={!!busy} onClick={() => input.current?.click()}>Escolher fotos</button>
          <p className="mt-2 text-xs text-mute">JPG, PNG ou WebP, até 4 MB cada. A primeira foto é a principal.</p>
        </div>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Escolher fotos do produto"
          onChange={(e) => { void handle([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Escolher foto para substituir"
          onChange={(e) => { const f = e.target.files?.[0]; if (f && replaceId) void handle([f], replaceId); e.target.value = ""; }} />
      </div>

      {busy && (
        <div role="status" className="flash">Enviando {busy.label}... {busy.pct}%<div className="mt-1 h-1.5 bg-ink"><div className="h-full bg-accent" style={{ width: `${busy.pct}%` }} /></div></div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text}</p>}

      {(images.length > 0 || staged.length > 0) ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((i, idx) => (
            <li key={i.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={`Foto ${idx + 1}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
              {idx === 0 && <span className="badge badge-accent">Principal</span>}
              <div className="flex flex-wrap gap-1">
                <form action={moveImage} className="flex gap-1"><input type="hidden" name="id" value={i.id} />
                  <button name="dir" value="up" className="btn btn-ghost !px-3" aria-label="Mover para antes">←</button>
                  <button name="dir" value="down" className="btn btn-ghost !px-3" aria-label="Mover para depois">→</button></form>
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => { setReplaceId(i.id); setTimeout(() => replaceInput.current?.click(), 0); }}>Trocar</button>
                <form action={removeImage}><input type="hidden" name="id" value={i.id} /><ConfirmButton message="Remover esta foto do produto?">Remover</ConfirmButton></form>
              </div>
            </li>
          ))}
          {staged.map((s) => (
            <li key={s.key} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.preview} alt="Prévia" className="aspect-[3/4] w-full object-cover" />
              <p className="text-xs text-mute">{s.error ? <span className="text-red-400">{s.error}</span> : "Será enviada ao salvar"}</p>
              <button type="button" className="btn btn-ghost" onClick={() => onStage?.(staged.filter((x) => x.key !== s.key))}>Remover</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-mute">Nenhuma foto ainda.</p>}
    </div>
  );
}
