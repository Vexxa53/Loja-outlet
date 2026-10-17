import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bestSellers, listFor } from "@/lib/catalog";
import { Shelf } from "@/components/ProductCard";

export default async function Home() {
  const [s, banners, cats, featured, news, sale, best] = await Promise.all([
    getSettings(),
    db.banner.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    db.category.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    listFor({ featured: true }),
    listFor({ isNew: true }),
    listFor({ promoPriceCents: { not: null } }, 8, { updatedAt: "desc" }),
    bestSellers(8),
  ]);
  const hero = banners.filter((b) => b.placement === "hero");
  const secondary = banners.filter((b) => b.placement === "secondary").slice(0, 3);
  return (
    <>
      {hero[0] && (
        <section className="relative isolate min-h-[420px] md:min-h-[560px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero[0].imageUrl} alt={hero[0].title} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="container-x flex min-h-[420px] md:min-h-[560px] flex-col justify-center gap-4">
            <h1 className="h-display max-w-2xl text-4xl md:text-7xl text-accent">{hero[0].title}</h1>
            {hero[0].subtitle && <p className="max-w-lg text-lg">{hero[0].subtitle}</p>}
            {hero[0].link && <div><Link href={hero[0].link} className="btn">{hero[0].ctaLabel || "Comprar agora"}</Link></div>}
          </div>
        </section>
      )}
      {secondary.length > 0 && (
        <section className="container-x grid gap-4 py-8 md:grid-cols-3">
          {secondary.map((b) => (
            <Link key={b.id} href={b.link || "/produtos"} className="group relative block aspect-[16/10] overflow-hidden card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <p className="absolute bottom-3 left-4 h-display text-xl">{b.title}</p>
            </Link>
          ))}
        </section>
      )}
      {cats.length > 0 && (
        <section className="container-x py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cats.map((c) => (
              <Link key={c.id} href={`/produtos?categoria=${c.slug}`} className="card relative grid aspect-[4/3] place-items-center overflow-hidden hover:border-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.imageUrl && <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
                <span className="relative h-display text-lg">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Shelf title={s.homeSections.featured} href="/produtos" items={featured} />
      <Shelf title={s.homeSections.news} href="/produtos?ordem=recentes" items={news} />
      <Shelf title={s.homeSections.bestSellers} href="/produtos?ordem=vendidos" items={best} />
      <Shelf title={s.homeSections.sale} href="/produtos?promo=1" items={sale} />
      {!featured.length && !news.length && !sale.length && !best.length && (
        <p className="container-x py-20 text-center text-mute">Em breve novos produtos.</p>
      )}
    </>
  );
}
