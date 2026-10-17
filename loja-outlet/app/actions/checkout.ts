"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCartToken } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { checkoutSchema, createOrderFromCart, OrderError } from "@/lib/orders";
import { createPreference, mpConfigured } from "@/lib/payments/mercadopago";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function placeOrder(_: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  if (!(await rateLimit(`checkout:${await clientIp()}`, 15, 600))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const token = await getCartToken();
  if (!token) return { error: "Carrinho vazio." };
  const customer = await getCustomer();
  let orderId: string;
  try {
    const order = await createOrderFromCart({ cartToken: token, customerId: customer?.id ?? null, input: parsed.data });
    orderId = order.id;
    if (mpConfigured() && process.env.BASE_URL) {
      const existing = await db.payment.findFirst({ where: { orderId: order.id } });
      if (!existing) {
        const url = await createPreference(order, process.env.BASE_URL);
        await db.payment.create({ data: { orderId: order.id, provider: "mercadopago", status: "PENDING", amountCents: order.totalCents } });
        redirect(url);
      }
    }
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    if (typeof e === "object" && e && "digest" in e) throw e; // redirect interno do Next
    console.error("checkout", e instanceof Error ? e.message : "erro");
    return { error: "Não foi possível concluir o pedido. Tente novamente." };
  }
  redirect(`/pedido/${orderId}`);
}
