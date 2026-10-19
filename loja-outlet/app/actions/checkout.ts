"use server";
import { redirect } from "next/navigation";
import { getCartToken, priceCart, shippingFor } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { checkoutSchema, createOrderFromCart, OrderError } from "@/lib/orders";
import { createPreference } from "@/lib/payments/mercadopago";
import { getCheckoutOptions } from "@/lib/payments/config";
import { initPayment, PaymentError } from "@/lib/payments/service";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Calcula o frete no servidor a partir do carrinho real (o navegador não informa valores). */
export async function quoteCheckoutShipping(zip: string): Promise<{ label: string; days: number; priceCents: number } | null> {
  if (!(await rateLimit(`quote:${await clientIp()}`, 60, 600))) return null;
  const customer = await getCustomer();
  const cart = await priceCart(customer?.id, customer?.email);
  if (!cart.lines.length) return null;
  const q = await shippingFor(zip, cart.subtotalCents - cart.discountCents);
  return q ? { label: q.label, days: q.days, priceCents: q.priceCents } : null;
}

export async function placeOrder(_: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  if (!parsed.data.paymentMethod) return { error: "Escolha a forma de pagamento." };
  if (!(await rateLimit(`checkout:${await clientIp()}`, 15, 600))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const token = await getCartToken();
  if (!token) return { error: "Carrinho vazio." };
  const customer = await getCustomer();
  const opts = await getCheckoutOptions();
  if (!opts.methods.some((m) => m.method === parsed.data.paymentMethod)) return { error: "Forma de pagamento indisponível. Escolha outra." };
  let orderId: string;
  let redirectTo: string | null = null;
  try {
    const order = await createOrderFromCart({ cartToken: token, customerId: customer?.id ?? null, input: parsed.data });
    orderId = order.id;
    const payment = await initPayment({ orderId: order.id, method: parsed.data.paymentMethod, installments: parsed.data.installments });
    // Gateway real (quando ativado): o valor enviado é o do pedido salvo; o cliente conclui no ambiente do gateway.
    if (payment.provider === "mercadopago" && process.env.BASE_URL && !payment.externalId) {
      redirectTo = await createPreference(order, process.env.BASE_URL);
    }
  } catch (e) {
    if (e instanceof OrderError || e instanceof PaymentError) return { error: e.message };
    console.error("checkout", e instanceof Error ? e.message : "erro");
    return { error: "Não foi possível concluir o pedido. Tente novamente." };
  }
  redirect(redirectTo ?? `/pedido/${orderId}`);
}
