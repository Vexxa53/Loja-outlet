import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCustomer } from "@/lib/auth";
import { getCartToken } from "@/lib/cart";
import { getNavDepartments } from "@/lib/nav-data";
import { MegaNav } from "@/components/store/MegaNav";
import { MobileMenu } from "@/components/store/MobileMenu";
import { SearchBox } from "@/components/store/SearchBox";
import { FavoritesLink } from "@/components/store/FavoriteButton";
import { IconBag, IconUser } from "@/components/store/icons";
import { Newsletter } from "@/components/store/Newsletter";

export function promoItems(s: Awaited<ReturnType<typeof getSettings>>): string[] {
  if (s.promoBar.length) return s.promoBar;
  return [`Frete grátis acima de R$ ${(s.shipping.freeAboveCents / 100).toFixed(0)}`, "Troca e devolução conforme a política da loja", s.tagline];
}

export async function Header() {
  const [s, customer, token, departments] = await Promise.all([getSettings(), getCustomer(), getCartToken(), getNavDepartments()]);
  const count = token ? (await db.cartItem.aggregate({ where: { cart: { token } }, _sum: { quantity: true } }))._sum.quantity ?? 0 : 0;
  const trending = departments.flatMap((d) => d.categories).slice(0, 6).map((c) => ({ name: c.name, slug: c.slug }));
  const promos = promoItems(s);
  const icon = "relative inline-flex h-11 min-w-11 items-center justify-center gap-1 hover:text-accent";
  return (
    <header className="sticky top-0 z-40 border-b border-steel bg-ink/95 backdrop-blur">
      <div className="bg-accent text-black">
        <ul className="container-x flex items-center justify-center gap-x-8 py-1 text-center text-[11px] font-bold uppercase tracking-wider md:text-xs">
          {promos.map((p, i) => (<li key={i} className={i === 0 ? "" : "hidden md:list-item"}>{p}</li>))}
        </ul>
      </div>
      <div className="container-x flex items-center gap-2 py-2 md:gap-5">
        <MobileMenu departments={departments} trending={trending} accountHref={customer ? "/conta" : "/conta/entrar"} accountLabel={customer ? "Minha conta" : "Entrar ou cadastrar"} />
        <Link href="/" className="h-display inline-flex min-h-11 items-center gap-[0.3em] text-xl tracking-tight md:text-3xl" aria-label={`${s.name} — página inicial`}>
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={s.name} className="h-9 w-auto md:h-11" />
          ) : (<>{s.name.split(" ")[0]}<span className="text-accent">{s.name.split(" ").slice(1).join(" ")}</span></>)}
        </Link>
        <div className="hidden max-w-2xl flex-1 md:block"><SearchBox trending={trending} /></div>
        <nav aria-label="Conta e sacola" className="ml-auto flex items-center md:gap-1">
          <Link href="/favoritos" className={icon} aria-label="Favoritos"><FavoritesLink /></Link>
          <Link href={customer ? "/conta" : "/conta/entrar"} className={icon} aria-label={customer ? "Minha conta" : "Entrar"}><IconUser /><span className="hidden text-sm font-semibold uppercase lg:inline">{customer ? "Conta" : "Entrar"}</span></Link>
          <Link href="/carrinho" className={icon} aria-label={`Sacola, ${count} itens`}>
            <IconBag /><span className="absolute -right-1 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-black">{count}</span>
          </Link>
        </nav>
      </div>
      <div className="container-x pb-2 md:hidden"><SearchBox id="search-bar" trending={trending} /></div>
      <MegaNav departments={departments} />
    </header>
  );
}

export async function Footer() {
  const s = await getSettings();
  const social = [["Instagram", s.instagram], ["Facebook", s.facebook], ["TikTok", s.tiktok]].filter(([, u]) => u);
  const a = "inline-flex min-h-11 items-center hover:text-accent";
  return (
    <footer className="mt-16 border-t-4 border-accent bg-graphite">
      <Newsletter name={s.name} />
      <div className="container-x grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="h-display text-xl">{s.name}</p><p className="mt-2 text-mute">{s.about}</p></div>
        <div><p className="label">Ajuda</p>
          <ul><li><Link className={a} href="/conta/pedidos">Meus pedidos</Link></li><li><Link className={a} href="/politicas/trocas">Trocas e devoluções</Link></li><li><Link className={a} href="/carrinho">Calcular frete</Link></li><li><Link className={a} href="/favoritos">Favoritos</Link></li></ul></div>
        <div><p className="label">Institucional</p>
          <ul><li><Link className={a} href="/politicas/privacidade">Política de privacidade</Link></li><li><Link className={a} href="/politicas/termos">Termos de uso</Link></li><li><Link className={a} href="/conta/privacidade">Seus dados (LGPD)</Link></li></ul></div>
        <div><p className="label">Atendimento</p>
          {s.contactEmail && <p><a className={a} href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></p>}{s.contactPhone && <p>{s.contactPhone}</p>}{s.address && <p className="text-mute">{s.address}</p>}
          {social.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4">{social.map(([n, u]) => <li key={n}><a className={a} href={u} target="_blank" rel="noopener noreferrer">{n}</a></li>)}</ul>}</div>
      </div>
      <p className="border-t border-steel py-4 text-center text-xs text-mute">© {new Date().getFullYear()} {s.name}. Todos os direitos reservados. Navegação protegida por HTTPS.</p>
    </footer>
  );
}
