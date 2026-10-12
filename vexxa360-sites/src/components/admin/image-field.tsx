"use client";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { resizeImage } from "./image-utils";

/** Campo de arquivo com pré-visualização; reduz a imagem antes de enviar. */
export function ImageField({ name, label, current, required }: { name: string; label: string; current?: string | null; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError("Use JPG, PNG ou WebP."); e.target.value = ""; return; }
    const small = await resizeImage(f);
    if (small.size > 4 * 1024 * 1024) { setError("A imagem excede 4 MB."); e.target.value = ""; return; }
    const dt = new DataTransfer();
    dt.items.add(small);
    if (input.current) input.current.files = dt.files;
    setPreview(URL.createObjectURL(small));
  }

  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-soft">
          {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Pré-visualização" className="size-full object-cover" /> : <ImagePlus className="size-6 text-muted" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <input ref={input} id={name} name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required && !current} onChange={onChange}
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-white" />
          <p className="mt-1 text-xs text-muted">JPG, PNG ou WebP · até 4 MB (reduzimos automaticamente).</p>
          {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
