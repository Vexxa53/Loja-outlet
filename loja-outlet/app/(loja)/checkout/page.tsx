import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { priceCart } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCheckoutOptions } from "@/lib/payments/config";
import { CheckoutWizard } from "./CheckoutWizard";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout({ searchParams }: { searchParams: Promise<{ cep?: string }> }) {
  const { cep } = await searchParams;
  const customer = await getCustomer();
  const cart = await priceCart(customer?.id, customer?.email);
  if (!cart.lines.length) redirect("/carrinho");
  const addr = customer ? await db.address.findFirst({ where: { customerId: customer.id }, orderBy: [{ isDefault: "desc" }] }) : null;
  const opts = await getCheckoutOptions();
  return (
    <CheckoutWizard
      idempotencyKey={randomUUID()}
      loggedIn={!!customer}
      lines={cart.lines.map((l) => ({ id: l.itemId, name: l.name, color: l.color, size: l.size, quantity: l.quantity, totalCents: l.totalCents, imageUrl: l.imageUrl }))}
      subtotalCents={cart.subtotalCents} discountCents={cart.discountCents} couponCode={cart.couponCode ?? null}
      defaults={{ name: customer?.name ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "", zip: cep ?? addr?.zip ?? "", street: addr?.street ?? "", number: addr?.number ?? "", complement: addr?.complement ?? "", district: addr?.district ?? "", city: addr?.city ?? "", state: addr?.state ?? "" }}
      methods={opts.methods} rule={opts.rule} mode={opts.mode}
    />
  );
}
