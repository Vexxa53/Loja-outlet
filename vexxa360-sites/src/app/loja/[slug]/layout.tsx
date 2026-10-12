import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, AtSign, Clock, MapPin, Mail } from "lucide-react";
import { getCategories, getStore } from "@/lib/data/store";
import { mediaUrl } from "@/lib/env";
import { readableOn, safeHex } from "@/lib/color";
import { CartProvider } from "@/components/store/cart";
import { StoreHeader } from "@/components/store/header";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: "Loja não encontrada", robots: { index: false } };
  const s = store.settings;
  const title = s.seo_title || s.store_name;
  const description = s.seo_description || s.description || `Conheça os produtos de ${s.store_name}.`;
  const logo = mediaUrl(s.logo_path);
  return {
    title: { default: title, template: `%s | ${s.store_name}` },
    description,
    alternates: { canonical: `/loja/${slug}` },
    openGraph: { title, description, type: "website", siteName: s.store_name, locale: "pt_BR", images: logo ? [logo] : undefined },
    robots: s.published ? undefined : { index: false, follow: false },
  };
}

export default async function StoreLayout({ children, params }: Props) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  const { settings: s, tenant } = store;
  const categories = await getCategories(tenant.id);
  const brand = safeHex(s.primary_color, "#111111");
  const accent = safeHex(s.secondary_color, "#b08968");
  const logo = mediaUrl(s.logo_path);
  const wa = s.whatsapp;

  return (
    <CartProvider slug={slug}>
      <div
        className="flex min-h-screen flex-col"
        style={{ "--brand": brand, "--on-brand": readableOn(brand), "--accent": accent } as React.CSSProperties}
      >
        {!s.published && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
            Pré-visualização: esta loja ainda <strong>não está publicada</strong> — só a equipe da loja vê esta página.
          </div>
        )}
        <StoreHeader slug={slug} name={s.store_name} logoUrl={logo} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-line bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
            <div>
              <p className="font-serif text-xl">{s.store_name}</p>
              {s.description && <p className="mt-2 max-w-sm text-sm text-muted">{s.description}</p>}
            </div>
            <ul className="space-y-2 text-sm text-muted">
              {wa && <li className="flex items-center gap-2"><MessageCircle className="size-4" /><a className="hover:text-ink" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              {s.instagram && <li className="flex items-center gap-2"><AtSign className="size-4" /><a className="hover:text-ink" href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer">@{s.instagram}</a></li>}
              {s.contact_email && <li className="flex items-center gap-2"><Mail className="size-4" /><a className="hover:text-ink" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
              {s.business_hours && <li className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" />{s.business_hours}</li>}
              {s.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{s.address}</li>}
            </ul>
            <div className="space-y-2 text-sm text-muted">
              <Link className="block hover:text-ink" href={`/loja/${slug}/produtos`}>Todos os produtos</Link>
              {s.shipping_info && <p className="whitespace-pre-line">{s.shipping_info}</p>}
              {s.exchange_url && <a className="block hover:text-ink" href={s.exchange_url} target="_blank" rel="noopener noreferrer">Trocas e devoluções</a>}
              {s.privacy_url && <a className="block hover:text-ink" href={s.privacy_url} target="_blank" rel="noopener noreferrer">Privacidade</a>}
              {s.terms_url && <a className="block hover:text-ink" href={s.terms_url} target="_blank" rel="noopener noreferrer">Termos de uso</a>}
            </div>
          </div>
          <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} {s.store_name} · Loja criada com Vexxa360°</div>
        </footer>

        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá, ${s.store_name}! Vim pelo site.`)}`} target="_blank" rel="noopener noreferrer"
            aria-label="Falar no WhatsApp" className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105">
            <MessageCircle className="size-7" />
          </a>
        )}
      </div>
    </CartProvider>
  );
}
