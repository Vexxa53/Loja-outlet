import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bestSellers, listFor } from "@/lib/catalog";
import { Shelf } from "@/components/ProductCard";
import { HeroCarousel, type Slide } from "@/components/HeroCarousel";

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
  const hero = banners.filter((b) => b.placement === "hero").slice(0, 5);
  // Sem banners cadastrados no painel, mostra 3 slides padrão (sem imagem) com as categorias da loja.
  const slides: Slide[] = hero.length
    ? hero.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, link: b.link, imageUrl: b.imageUrl }))
    : [
        { id: "d1", title: s.name, subtitle: "Camisetas de grife e calças com preço de outlet.", ctaLabel: "Ver roupas", link: "/produtos?categoria=camisetas-de-grife" },
        { id: "d2", title: "Tênis em oferta", subtitle: "Os modelos que você procura, com desconto de verdade.", ctaLabel: "Ver tênis", link: "/produtos?categoria=tenis" },
        { id: "d3", title: "Relógios, acessórios e perfumes", subtitle: "Complete o visual com grife e preço baixo.", ctaLabel: "Ver novidades", link: "/produtos?categoria=relogios" },
      ];
  const secondary = banners.filter((b) => b.placement === "secondary").slice(0, 3);
  return (
    <>
      <HeroCarousel slides={slides} />
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
