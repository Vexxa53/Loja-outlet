import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Flash } from "@/components/Flash";
import { saveStoreSettings } from "@/app/actions/admin-misc";

const m = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("settings.write");
  const sp = await searchParams;
  const s = await getSettings();
  const f = (name: string, label: string, def: string) => (<div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={def} className="input" /></div>);
  const t = (name: string, label: string, def: string) => (<div><label className="label" htmlFor={name}>{label}</label><textarea id={name} name={name} defaultValue={def} rows={4} className="input" /></div>);
  return (
    <div className="space-y-4"><h1 className="h-display text-2xl">Configurações da loja</h1><Flash ok={sp.ok} erro={sp.erro} />
      <form action={saveStoreSettings} className="card space-y-5 p-4">
        <div className="grid gap-3 md:grid-cols-3">{f("name", "Nome da loja", s.name)}{f("tagline", "Slogan (faixa superior)", s.tagline)}{f("accent", "Cor de destaque (#RRGGBB)", s.accent)}
          <label className="block"><span className="label">Logotipo {s.logoUrl && "(enviado)"}</span><input type="file" name="logo" accept="image/jpeg,image/png,image/webp" className="input" /></label>
          <label className="block"><span className="label">Favicon {s.faviconUrl && "(enviado)"}</span><input type="file" name="favicon" accept="image/png,image/webp" className="input" /></label></div>
        <div className="grid gap-3 md:grid-cols-3">{f("contactEmail", "E-mail de contato", s.contactEmail)}{f("contactPhone", "Telefone", s.contactPhone)}{f("address", "Endereço", s.address)}{f("instagram", "Instagram (https://...)", s.instagram)}{f("facebook", "Facebook (https://...)", s.facebook)}{f("tiktok", "TikTok (https://...)", s.tiktok)}</div>
        <div className="grid gap-3 md:grid-cols-3">{f("promo1", "Barra de avisos — frase 1 (vazio = padrão)", s.promoBar[0] ?? "")}{f("promo2", "Frase 2", s.promoBar[1] ?? "")}{f("promo3", "Frase 3", s.promoBar[2] ?? "")}</div>
        <div className="grid gap-3 md:grid-cols-4">{f("secFeatured", "Título: destaques", s.homeSections.featured)}{f("secNews", "Título: novidades", s.homeSections.news)}{f("secBest", "Título: mais vendidos", s.homeSections.bestSellers)}{f("secSale", "Título: ofertas", s.homeSections.sale)}</div>
        <div className="grid gap-3 md:grid-cols-2">{f("seoTitle", "SEO: título", s.seoTitle)}{f("seoDescription", "SEO: descrição", s.seoDescription)}</div>
        {t("about", "Sobre a loja (rodapé)", s.about)}{t("privacyPolicy", "Política de privacidade", s.privacyPolicy)}{t("exchangePolicy", "Trocas e devoluções", s.exchangePolicy)}{t("termsPolicy", "Termos de uso", s.termsPolicy)}
        <h2 className="font-bold uppercase">Frete por região (tabela própria)</h2>
        <div className="grid gap-3 md:grid-cols-6">{f("freeAbove", "Grátis acima de (R$)", m(s.shipping.freeAboveCents))}
          {(["SE", "S", "CO", "NE", "N"] as const).map((r) => (<div key={r} className="space-y-1">{f(`ship_${r}`, `${r} — R$`, m(s.shipping.regions[r].priceCents))}{f(`days_${r}`, `${r} — dias`, String(s.shipping.regions[r].days))}</div>))}</div>
        <button className="btn">Salvar configurações</button></form></div>
  );
}
