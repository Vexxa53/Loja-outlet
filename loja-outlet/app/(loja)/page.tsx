import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bestSellers, listFor } from "@/lib/catalog";
import { getNavDepartments } from "@/lib/nav-data";
import { Shelf } from "@/components/ProductCard";
import { HeroCarousel, type Slide } from "@/components/HeroCarousel";
import { BenefitsBar, BrandStrip, CategoryTiles, FaqSection, SizeShortcuts } from "@/components/store/HomeSections";

export default async function Home() {
  const [s, banners, departments, featured, news, sale, best] = await Promise.all([
    getSettings(),
    db.banner.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    getNavDepartments(),
    listFor({ featured: true }, 10),
    listFor({ isNew: true }, 10),
    listFor({ promoPriceCents: { not: null } }, 10, { updatedAt: "desc" }),
    bestSellers(10),
  ]);
  const hero = banners.filter((b) => b.placement === "hero").slice(0, 6);
  const secondary = banners.filter((b) => b.placement === "secondary").slice(0, 3);
  // Sem banners cadastrados no painel, mostra 3 slides padrão (sem imagem) com as categorias da loja.
  const slides: Slide[] = hero.length
    ? hero.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, link: b.link, imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl, device: b.device }))
    : [
        { id: "d1", title: "Moda masculina", subtitle: "Camisas, calças, jaquetas e muito mais com preço de outlet.", ctaLabel: "Ver roupas", link: "/produtos?categoria=camisas" },
        { id: "d2", title: "Tênis em oferta", subtitle: "Os modelos que você procura, com desconto de verdade.", ctaLabel: "Ver tênis", link: "/produtos?categoria=tenis" },
        { id: "d3", title: "Relógios para todo estilo", subtitle: "Complete o visual com um relógio.", ctaLabel: "Ver relógios", link: "/produtos?categoria=relogios" },
      ];
  const empty = !featured.length && !news.length && !sale.length && !best.length;
  return (
    <>
      <HeroCarousel slides={slides} />
      <BenefitsBar s={s} />
      <CategoryTiles departments={departments} />
      <Shelf id="sh-news" title={s.homeSections.news} href="/produtos?novo=1" items={news} />
      <Shelf id="sh-feat" title={s.homeSections.featured} href="/produtos" items={featured} />
      {secondary.length > 0 && (
        <section className="container-x grid gap-4 py-6 md:grid-cols-3" aria-label="Campanhas">
          {secondary.map((b) => (
            <Link key={b.id} href={b.link || "/produtos"} className={`group relative aspect-[16/10] overflow-hidden card ${b.device === "desktop" ? "hidden md:block" : b.device === "mobile" ? "block md:hidden" : "block"}`}>
              <picture>
                {b.mobileImageUrl && <source media="(max-width: 767px)" srcSet={b.mobileImageUrl} />}
                { }
                <img src={b.imageUrl} alt={b.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <p className="absolute bottom-3 left-4 h-display text-xl">{b.title}</p>
            </Link>
          ))}
        </section>
      )}
      <SizeShortcuts />
      <Shelf id="sh-best" title={s.homeSections.bestSellers} href="/produtos?ordem=vendidos" items={best} />
      <Shelf id="sh-sale" title={s.homeSections.sale} href="/produtos?promo=1" items={sale} />
      <BrandStrip />
      {empty && <p className="container-x py-20 text-center text-mute">Em breve novos produtos.</p>}
      <FaqSection s={s} />
    </>
  );
}
