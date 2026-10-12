"use client";
import Image from "next/image";
import { useState } from "react";
import { cn } from "../ui";

export function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="grid aspect-[3/4] place-items-center rounded-2xl bg-soft text-sm text-muted">Sem foto</div>;
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div className="grid gap-3 sm:grid-cols-[72px_1fr]">
      <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col" role="tablist" aria-label={`Fotos de ${name}`}>
        {images.map((im, k) => (
          <button key={im.url} role="tab" aria-selected={k === i} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`}
            className={cn("relative size-16 shrink-0 overflow-hidden rounded-lg border-2 sm:size-[72px]", k === i ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")}>
            <Image src={im.url} alt="" fill sizes="72px" className="object-cover" />
          </button>
        ))}
      </div>
      <div className="relative order-1 aspect-[3/4] overflow-hidden rounded-2xl bg-soft sm:order-2">
        <Image src={cur.url} alt={cur.alt || name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
      </div>
    </div>
  );
}
