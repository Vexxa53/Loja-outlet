import Link from "next/link";
import { db } from "@/lib/db";
import { brl } from "@/lib/money";
import type { StoreSettings } from "@/lib/settings";
import type { NavDepartment } from "@/lib/nav";
import { sortSizes } from "@/lib/nav";
import { IconChat, IconReturn, IconShield, IconTruck } from "./icons";

export function BenefitsBar({ s }: { s: StoreSettings }) {
  const items = [
    { Icon: IconTruck, title: "Frete grátis", text: `Em compras acima de ${brl(s.shipping.freeAboveCents)}` },
    { Icon: IconReturn, title: "Troca e devolução", text: "Veja a política da loja" },
    { Icon: IconShield, title: "Compra segura", text: "Seus dados protegidos" },
    { Icon: IconChat, title: "Atendimento", text: s.contactEmail || "Fale com a gente" },
  ];
  return (
    <section aria-label="Vantagens" className="border-b border-steel bg-graphite">
      <ul className="container-x grid grid-cols-2 gap-x-4 py-3 lg:grid-cols-4">
        {items.map(({ Icon, title, text }) => (
          <li key={title} className="flex min-h-14 items-center gap-3 py-1 text-sm">
            <span className="shrink-0 text-accent"><Icon /></span>
            <span className="min-w-0"><strong className="block text-xs uppercase">{title}</strong><span className="block truncate text-xs text-mute">{text}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CategoryTiles({ departments }: { departments: NavDepartment[] }) {
  const cats = departments.flatMap((d) => d.categories);
  if (!cats.length) return null;
  return (
    <section className="container-x py-8 md:py-10" aria-labelledby="cat-title">
      <h2 id="cat-title" className="h-display mb-4 border-b-4 border-accent pb-2 text-2xl md:text-3xl">Compre por categoria</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/produtos?categoria=${c.slug}`} className="group relative block aspect-square overflow-hidden bg-steel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image && <img src={c.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
                <span className="h-display block text-lg leading-tight">{c.name}</span><span className="text-xs text-accent">{c.count} produto(s)</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Compre pelo seu tamanho": atalhos para produtos disponíveis no tamanho (letras e números). */
export async function SizeShortcuts() {
  const rows = await db.variant.findMany({ where: { active: true, stock: { gt: 0 }, product: { status: "PUBLISHED" } }, select: { size: true }, distinct: ["size"] });
  const sizes = sortSizes(rows.map((r) => r.size)).filter((s) => s !== "Único");
  const letters = sizes.filter((s) => !/^\d+$/.test(s));
  const numbers = sizes.filter((s) => /^\d+$/.test(s));
  if (!letters.length && !numbers.length) return null;
  const chip = "inline-flex min-h-11 min-w-11 items-center justify-center border border-line px-3 text-sm font-semibold hover:border-accent hover:text-accent";
  const group = (label: string, list: string[]) => list.length > 0 && (
    <div><p className="label">{label}</p><div className="flex flex-wrap gap-2">{list.map((s) => <Link key={s} href={`/produtos?tamanho=${encodeURIComponent(s)}&disponivel=1`} className={chip}>{s}</Link>)}</div></div>
  );
  return (
    <section className="container-x py-6" aria-labelledby="size-title">
      <h2 id="size-title" className="h-display mb-4 border-b-4 border-accent pb-2 text-2xl md:text-3xl">Compre pelo seu tamanho</h2>
      <div className="grid gap-5 md:grid-cols-2">{group("Roupas", letters)}{group("Calçados e calças (numeração)", numbers)}</div>
    </section>
  );
}

/** Marcas: só aparece quando houver ao menos 3 marcas cadastradas nos produtos. */
export async function BrandStrip() {
  const rows = await db.product.groupBy({ by: ["brand"], where: { status: "PUBLISHED", brand: { not: null } }, _count: { _all: true }, orderBy: { _count: { brand: "desc" } }, take: 12 });
  const brands = rows.map((r) => r.brand!).filter(Boolean);
  if (brands.length < 3) return null;
  return (
    <section className="container-x py-6" aria-labelledby="brand-title">
      <h2 id="brand-title" className="h-display mb-4 border-b-4 border-accent pb-2 text-2xl md:text-3xl">Marcas</h2>
      <ul className="flex flex-wrap gap-2">{brands.map((b) => (<li key={b}><Link href={`/produtos?q=${encodeURIComponent(b)}`} className="inline-flex min-h-11 items-center border border-line px-4 text-sm font-semibold uppercase hover:border-accent hover:text-accent">{b}</Link></li>))}</ul>
    </section>
  );
}

export function FaqSection({ s }: { s: StoreSettings }) {
  const faqs: [string, string][] = [
    ["Como funciona o frete?", `O valor e o prazo aparecem no carrinho e no checkout assim que você informa o CEP. Compras acima de ${brl(s.shipping.freeAboveCents)} têm frete grátis.`],
    ["Quais são as formas de pagamento?", "O pagamento é feito em ambiente seguro, com as formas de pagamento disponibilizadas na etapa final da compra."],
    ["Posso trocar ou devolver?", "Sim. As regras estão na política de trocas e devoluções da loja, no rodapé do site."],
    ["Como acompanho meu pedido?", "Entre em Minha conta e abra Meus pedidos: lá aparecem o status e o código de rastreio assim que o pedido for enviado."],
    ["Como escolho o tamanho?", "Use os filtros de tamanho na lista de produtos e as opções da página do produto. Em caso de dúvida, fale com o atendimento."],
  ];
  return (
    <section className="container-x py-8" aria-labelledby="faq-title">
      <h2 id="faq-title" className="h-display mb-4 border-b-4 border-accent pb-2 text-2xl md:text-3xl">Perguntas frequentes</h2>
      <div className="divide-y divide-steel border border-steel">
        {faqs.map(([q, a]) => (<details key={q} className="group"><summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold hover:text-accent">{q}<span aria-hidden className="text-accent group-open:rotate-45">+</span></summary><p className="px-4 pb-4 text-sm text-zinc-300">{a}</p></details>))}
      </div>
    </section>
  );
}
