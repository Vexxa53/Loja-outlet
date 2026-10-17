import Link from "next/link";
import type { Metadata } from "next";
import { priceCart, shippingFor } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { brl } from "@/lib/money";
import { applyCoupon, removeCoupon, updateCartItem } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Carrinho" };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ cep?: string }> }) {
  const { cep } = await searchParams;
  const customer = await getCustomer();
  const cart = await priceCart(customer?.id, customer?.email);
  const ship = cep ? await shippingFor(cep, cart.subtotalCents - cart.discountCents) : null;
  if (!cart.lines.length) {
    return (<div className="container-x py-20 text-center"><h1 className="h-display text-3xl">Seu carrinho está vazio</h1><Link href="/produtos" className="btn mt-6">Ver produtos</Link></div>);
  }
  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="h-display mb-4 text-3xl">Carrinho</h1>
        <ul className="space-y-3">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="card flex gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.imageUrl ? <img src={l.imageUrl} alt="" className="h-24 w-20 object-cover" /> : <div className="h-24 w-20 bg-steel" />}
              <div className="flex-1">
                <Link href={`/produto/${l.slug}`} className="font-semibold">{l.name}</Link>
                <p className="text-sm text-mute">{l.color} · {l.size} · {l.sku}</p>
                <p className="text-accent font-bold">{brl(l.unitCents)} {l.unitCents < l.listCents && <span className="text-mute line-through text-xs">{brl(l.listCents)}</span>}</p>
                {l.problem && <p className="flash flash-err mt-1">{l.problem}</p>}
                <form action={updateCartItem} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="itemId" value={l.itemId} />
                  <input type="number" name="quantity" min={0} max={20} defaultValue={l.quantity} className="input !w-20" aria-label="Quantidade" />
                  <button className="btn btn-ghost !py-2">Atualizar</button>
                  <button name="quantity" value="0" className="text-sm text-mute underline">Remover</button>
                </form>
              </div>
              <p className="font-bold">{brl(l.totalCents)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="card h-fit space-y-4 p-4">
        <h2 className="h-display text-xl">Resumo</h2>
        <form action={applyCoupon} className="flex gap-2"><input name="code" placeholder="Cupom" className="input" aria-label="Cupom" /><button className="btn btn-ghost">Aplicar</button></form>
        {cart.couponError && <p className="flash flash-err">{cart.couponError}</p>}
        {cart.couponCode && <form action={removeCoupon} className="flash flex justify-between">Cupom {cart.couponCode}<button className="underline">remover</button></form>}
        <form method="get" className="flex gap-2"><input name="cep" defaultValue={cep} placeholder="CEP" inputMode="numeric" className="input" aria-label="CEP" /><button className="btn btn-ghost">Frete</button></form>
        {cep && !ship && <p className="flash flash-err">CEP inválido.</p>}
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{brl(cart.subtotalCents)}</dd></div>
          {cart.discountCents > 0 && <div className="flex justify-between text-accent"><dt>Desconto</dt><dd>-{brl(cart.discountCents)}</dd></div>}
          {ship && <div className="flex justify-between"><dt>{ship.label} ({ship.days} dias úteis)</dt><dd>{ship.priceCents ? brl(ship.priceCents) : "Grátis"}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{brl(cart.subtotalCents - cart.discountCents + (ship?.priceCents ?? 0))}</dd></div>
        </dl>
        {cart.valid ? <Link href={cep ? `/checkout?cep=${encodeURIComponent(cep)}` : "/checkout"} className="btn w-full">Finalizar compra</Link>
          : <p className="flash flash-err">Ajuste os itens indisponíveis para continuar.</p>}
      </aside>
    </div>
  );
}
