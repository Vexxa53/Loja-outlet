import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBanners, getCategories, getStore, listProducts } from "@/lib/data/store";
import { mediaUrl } from "@/lib/env";
import { ProductGrid } from "@/components/store/product-card";
import { btnClass } from "@/components/ui";

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
        {href && <Link href={href} className="text-sm underline underline-offset-4 hover:text-accent">Ver tudo</Link>}
      </div>
      {children}
    </section>
  );
}

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  const { settings: s, tenant } = store;
  const base = `/loja/${slug}`;

  const [banners, categories, latest, featured, offers] = await Promise.all([
    getBanners(tenant.id),
    getCategories(tenant.id),
    listProducts(tenant.id, { sort: "novidades" }, 8),
    listProducts(tenant.id, { featured: true }, 4),
    listProducts(tenant.id, { onSale: true }, 4),
  ]);

  return (
    <div className="fade-up">
      {banners.length > 0 ? (
        <section aria-label="Destaques" className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          {banners.map((b, i) => {
            const img = mediaUrl(b.image_path);
            return (
              <article key={b.id} className="relative min-h-[58vh] w-full shrink-0 snap-center sm:min-h-[70vh]">
                {img && <Image src={img} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-12 text-white sm:px-6">
                  <h1 className="max-w-xl font-serif text-4xl leading-tight sm:text-6xl">{b.title}</h1>
                  {b.subtitle && <p className="mt-3 max-w-lg text-base text-white/90">{b.subtitle}</p>}
                  {b.button_label && b.destination_url && (
                    <Link href={b.destination_url} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-ink hover:bg-white/90">{b.button_label}</Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="bg-soft">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">{s.store_name}</h1>
            {s.description && <p className="mt-4 max-w-xl text-lg text-muted">{s.description}</p>}
            <Link href={`${base}/produtos`} className={`${btnClass.primary} mt-8`}>Ver produtos</Link>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <Section title="Categorias">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => {
              const img = mediaUrl(c.image_path);
              return (
                <li key={c.id}>
                  <Link href={`${base}/produtos?categoria=${c.id}`} className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-soft">
                    {img && <Image src={img} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                    <span className="absolute inset-0 bg-black/25" />
                    <span className="absolute inset-0 grid place-items-center px-2 text-center font-serif text-xl text-white drop-shadow">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {latest.items.length > 0 ? (
        <Section title="Novidades" href={`${base}/produtos`}><ProductGrid slug={slug} items={latest.items} /></Section>
      ) : (
        <section className="mx-auto mt-16 max-w-7xl px-4 text-center text-muted sm:px-6">
          <p className="font-serif text-xl text-ink">Novidades em breve</p>
          <p className="mt-1 text-sm">Estamos preparando a vitrine. Volte logo!</p>
        </section>
      )}
      {featured.items.length > 0 && <Section title="Em destaque" href={`${base}/produtos`}><ProductGrid slug={slug} items={featured.items} /></Section>}
      {offers.items.length > 0 && <Section title="Ofertas" href={`${base}/produtos?promocao=1`}><ProductGrid slug={slug} items={offers.items} /></Section>}
    </div>
  );
}
