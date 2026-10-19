"use client";
import { useState } from "react";

export function Gallery({ images, name }: { images: { id: string; url: string; alt: string | null }[]; name: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="card grid aspect-[3/4] place-items-center text-mute">Sem imagem</div>;
  const cur = images[Math.min(i, images.length - 1)];
  const go = (d: number) => setI((i + d + images.length) % images.length);
  return (
    <div className="grid gap-3 md:grid-cols-[84px_1fr]" aria-roledescription="galeria de fotos" onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
      <ul className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col md:overflow-y-auto md:overflow-x-visible">
        {images.map((im, k) => (
          <li key={im.id} className="shrink-0">
            <button type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1} de ${images.length}`} aria-current={k === i} className={`block h-[84px] w-[63px] overflow-hidden border-2 md:h-28 md:w-[84px] ${k === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="h-full w-full object-cover" loading={k === 0 ? "eager" : "lazy"} />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative order-1 md:order-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt={cur.alt || name} className="aspect-[3/4] w-full object-cover card" fetchPriority="high" decoding="async" />
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className="absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 bg-black/60 text-2xl hover:bg-accent hover:text-black">‹</button>
            <button type="button" aria-label="Próxima foto" onClick={() => go(1)} className="absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 bg-black/60 text-2xl hover:bg-accent hover:text-black">›</button>
          </>
        )}
      </div>
    </div>
  );
}
