"use client";
import { useRef, useState } from "react";
import { checkFile, uploadFile } from "./upload-client";

export type Img = { url: string; path: string } | null;

/**
 * Campo de UMA imagem: escolher/arrastar, prévia imediata, barra de progresso, substituir e remover.
 * Envia o arquivo na hora para o armazenamento e devolve { url, path } ao formulário (que grava no banco ao salvar).
 */
export function ImageField({ label, hint, kind, value, onChange, aspect = "aspect-[16/6]" }: {
  label: string; hint?: string; kind: "banner" | "category" | "brand"; value: Img; onChange: (v: Img) => void; aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const bad = checkFile(file);
    if (bad) { setError(bad); return; }
    setLocal(URL.createObjectURL(file));
    setPct(0);
    const r = await uploadFile(file, { kind }, setPct);
    setPct(null);
    if (!r.ok) { setError(r.error); setLocal(null); return; }
    onChange({ url: r.url, path: r.path });
  }

  const shown = local ?? value?.url ?? null;
  return (
    <div>
      <span className="label">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files[0]); }}
        className={`relative grid ${aspect} min-h-28 w-full place-items-center overflow-hidden border-2 border-dashed ${drag ? "border-accent bg-steel" : "border-line bg-ink"}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Prévia da imagem" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <p className="px-3 text-center text-sm text-mute">Arraste uma imagem aqui<br />ou use o botão abaixo</p>
        )}
        {pct !== null && (
          <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs" role="status">
            Enviando... {pct}%<div className="mt-1 h-1.5 bg-steel"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={pct !== null}>{shown ? "Substituir imagem" : "Escolher imagem"}</button>
        {shown && pct === null && <button type="button" className="btn btn-ghost" onClick={() => { setLocal(null); onChange(null); }}>Remover</button>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
      {error && <p role="alert" className="flash flash-err mt-2">{error}</p>}
    </div>
  );
}
