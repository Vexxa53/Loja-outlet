import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCustomer } from "@/lib/auth";
import { getCartToken } from "@/lib/cart";

export async function Header() {
  const [s, customer, token, cats] = await Promise.all([
    getSettings(), getCustomer(), getCartToken(),
    db.category.findMany({ where: { active: true }, orderBy: { position: "asc" }, take: 8 }),
  ]);
  const count = token
    ? (await db.cartItem.aggregate({ where: { cart: { token } }, _sum: { quantity: true } }))._sum.quantity ?? 0
    : 0;
  return (
    <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur border-b border-steel">
      <div className="bg-accent text-black text-center text-xs font-bold py-1 uppercase tracking-wider">
        Frete grátis acima de R$ {(s.shipping.freeAboveCents / 100).toFixed(0)} · {s.tagline}
      </div>
      <div className="container-x flex items-center gap-4 py-3">
        <Link href="/" className="h-display text-2xl tracking-tight">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={s.name} className="h-9 w-auto" />
          ) : (
            <>{s.name.split(" ")[0]}<span className="text-accent">{s.name.split(" ").slice(1).join(" ")}</span></>
          )}
        </Link>
        <form action="/produtos" className="hidden flex-1 md:block">
          <input name="q" placeholder="Buscar produtos..." className="input" aria-label="Buscar" />
        </form>
        <nav className="ml-auto flex items-center gap-4 text-sm font-semibold uppercase">
          <Link href={customer ? "/conta" : "/conta/entrar"}>{customer ? "Minha conta" : "Entrar"}</Link>
          <Link href="/carrinho" className="relative">
            Carrinho
            <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-black" aria-label={`${count} itens`}>{count}</span>
          </Link>
        </nav>
      </div>
      <div className="border-t border-steel">
        <nav className="container-x flex gap-5 overflow-x-auto py-2 text-sm font-semibold uppercase whitespace-nowrap">
          <Link href="/produtos" className="hover:text-accent">Todos</Link>
          {cats.map((c) => <Link key={c.id} href={`/produtos?categoria=${c.slug}`} className="hover:text-accent">{c.name}</Link>)}
          <Link href="/produtos?promo=1" className="text-accent">Ofertas</Link>
        </nav>
      </div>
      <form action="/produtos" className="container-x pb-2 md:hidden">
        <input name="q" placeholder="Buscar produtos..." className="input" aria-label="Buscar" />
      </form>
    </header>
  );
}

export async function Footer() {
  const s = await getSettings();
  const social = [["Instagram", s.instagram], ["Facebook", s.facebook], ["TikTok", s.tiktok]].filter(([, u]) => u);
  return (
    <footer className="mt-16 border-t-4 border-accent bg-graphite">
      <div className="container-x grid gap-8 py-10 md:grid-cols-4">
        <div><p className="h-display text-xl">{s.name}</p><p className="mt-2 text-sm text-mute">{s.about}</p></div>
        <div className="text-sm"><p className="label">Contato</p>{s.contactEmail && <p>{s.contactEmail}</p>}{s.contactPhone && <p>{s.contactPhone}</p>}{s.address && <p className="text-mute">{s.address}</p>}</div>
        <div className="text-sm space-y-1"><p className="label">Institucional</p>
          <p><Link href="/politicas/privacidade">Privacidade</Link></p>
          <p><Link href="/politicas/trocas">Trocas e devoluções</Link></p>
          <p><Link href="/politicas/termos">Termos de uso</Link></p>
        </div>
        <div className="text-sm space-y-1"><p className="label">Redes sociais</p>
          {social.length ? social.map(([n, u]) => <p key={n}><a href={u} target="_blank" rel="noopener noreferrer">{n}</a></p>) : <p className="text-mute">—</p>}
        </div>
      </div>
      <p className="border-t border-steel py-4 text-center text-xs text-mute">© {new Date().getFullYear()} {s.name}. Todos os direitos reservados.</p>
    </footer>
  );
}
