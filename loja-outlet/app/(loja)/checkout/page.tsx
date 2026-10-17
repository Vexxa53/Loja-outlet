import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { priceCart, shippingFor } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/money";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout" };

export default async function Checkout({ searchParams }: { searchParams: Promise<{ cep?: string }> }) {
  const { cep } = await searchParams;
  const customer = await getCustomer();
  const cart = await priceCart(customer?.id, customer?.email);
  if (!cart.lines.length) redirect("/carrinho");
  const net = cart.subtotalCents - cart.discountCents;
  const ship = cep ? await shippingFor(cep, net) : null;
  const addr = customer ? await db.address.findFirst({ where: { customerId: customer.id }, orderBy: [{ isDefault: "desc" }] }) : null;
  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="h-display mb-4 text-3xl">Checkout</h1>
        {!customer && <p className="flash mb-4">Tem conta? <Link className="underline" href="/conta/entrar">Entre</Link> para acompanhar seus pedidos.</p>}
        {!ship ? (
          <form method="get" className="card space-y-3 p-4">
            <label className="label" htmlFor="cep">Informe o CEP para calcular o frete</label>
            <div className="flex gap-2"><input id="cep" name="cep" defaultValue={addr?.zip} inputMode="numeric" className="input" required /><button className="btn">Continuar</button></div>
            {cep && <p className="flash flash-err">CEP inválido.</p>}
          </form>
        ) : (
          <CheckoutForm key={cep} zip={cep!} idempotencyKey={randomUUID()} defaults={{ name: customer?.name ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "", street: addr?.street ?? "", number: addr?.number ?? "", complement: addr?.complement ?? "", district: addr?.district ?? "", city: addr?.city ?? "", state: addr?.state ?? "" }} />
        )}
      </div>
      <aside className="card h-fit space-y-3 p-4 text-sm">
        <h2 className="h-display text-xl">Resumo</h2>
        {cart.lines.map((l) => (<div key={l.itemId} className="flex justify-between gap-2"><span>{l.quantity}× {l.name} ({l.color}/{l.size})</span><span>{brl(l.totalCents)}</span></div>))}
        <div className="flex justify-between border-t border-line pt-2"><span>Subtotal</span><span>{brl(cart.subtotalCents)}</span></div>
        {cart.discountCents > 0 && <div className="flex justify-between text-accent"><span>Cupom {cart.couponCode}</span><span>-{brl(cart.discountCents)}</span></div>}
        <div className="flex justify-between"><span>Frete {ship ? `(${ship.days} dias úteis)` : ""}</span><span>{ship ? (ship.priceCents ? brl(ship.priceCents) : "Grátis") : "—"}</span></div>
        <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><span>Total</span><span>{brl(net + (ship?.priceCents ?? 0))}</span></div>
      </aside>
    </div>
  );
}
