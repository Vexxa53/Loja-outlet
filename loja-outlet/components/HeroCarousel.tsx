"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type Slide = { id: string; title: string; subtitle?: string | null; ctaLabel?: string | null; link?: string | null; imageUrl?: string | null };

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  if (!n) return null;
  return (
    <section
      className="relative isolate overflow-hidden bg-graphite"
      aria-roledescription="carrossel" aria-label="Destaques"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      <div className="relative min-h-[420px] md:min-h-[560px]">
        {slides.map((s, k) => (
          <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${n}`} aria-hidden={k !== i}
            className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {s.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-ink via-graphite to-steel">
                <div className="absolute -right-24 top-0 h-full w-72 -skew-x-12 bg-accent/15" />
                <div className="absolute right-24 top-0 h-full w-24 -skew-x-12 bg-accent/10" />
              </div>
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
            <div className="container-x flex h-full min-h-[420px] flex-col justify-center gap-4 md:min-h-[560px]">
              <h2 className="h-display max-w-2xl text-4xl text-accent md:text-7xl">{s.title}</h2>
              {s.subtitle && <p className="max-w-lg text-lg">{s.subtitle}</p>}
              {s.link && <div><Link href={s.link} className="btn" tabIndex={k === i ? 0 : -1}>{s.ctaLabel || "Comprar agora"}</Link></div>}
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Slide anterior" onClick={() => setI((i - 1 + n) % n)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 px-3 py-2 text-2xl hover:bg-accent hover:text-black">‹</button>
          <button type="button" aria-label="Próximo slide" onClick={() => setI((i + 1) % n)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 px-3 py-2 text-2xl hover:bg-accent hover:text-black">›</button>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {slides.map((s, k) => (
              <button key={s.id} type="button" aria-label={`Ir para o slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)}
                className={`h-2 w-8 ${k === i ? "bg-accent" : "bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
