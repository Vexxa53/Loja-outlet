"use server";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { rateLimit } from "../rate-limit";
import { mediaUrl } from "../env";
import { buildWhatsAppMessage, whatsappUrl, type OrderSnapshot } from "../whatsapp";
import { checkoutSchema } from "../validation/store";
import { fail, success, zodFail, type ActionState } from "../validation/common";
import { clientIp } from "./helpers";

export type PricedLine = {
  variantId: string;
  available: boolean;
  stock: number;
  name: string;
  productSlug: string;
  size: string | null;
  color: string | null;
  unitPrice: number;
  regularPrice: number;
  image: string | null;
};

/**
 * Preços e disponibilidade ATUAIS para exibir na sacola (o navegador só guarda variantId + quantidade).
 * Usa a chave pública: o RLS só devolve itens publicados de lojas publicadas.
 */
export async function priceCart(slug: string, variantIds: string[]): Promise<PricedLine[]> {
  const ids = [...new Set(variantIds.filter((v) => /^[0-9a-f-]{36}$/i.test(v)))].slice(0, 40);
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!tenant) return [];
  const { data: variants } = await supabase.from("product_variants").select("id, product_id, size, color, stock_quantity, active").in("id", ids).eq("tenant_id", tenant.id);
  const productIds = [...new Set((variants ?? []).map((v: any) => v.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("catalog_products").select("id, name, slug, regular_price, effective_price, image_path").in("id", productIds).eq("tenant_id", tenant.id)
    : { data: [] as any[] };
  const pMap = new Map((products ?? []).map((p: any) => [p.id, p]));
  return ids.map((id) => {
    const v: any = (variants ?? []).find((x: any) => x.id === id);
    const p: any = v ? pMap.get(v.product_id) : undefined;
    if (!v || !p) return { variantId: id, available: false, stock: 0, name: "Produto indisponível", productSlug: "", size: null, color: null, unitPrice: 0, regularPrice: 0, image: null };
    return {
      variantId: id, available: v.active && v.stock_quantity > 0, stock: v.active ? v.stock_quantity : 0,
      name: p.name, productSlug: p.slug, size: v.size, color: v.color,
      unitPrice: Number(p.effective_price), regularPrice: Number(p.regular_price), image: mediaUrl(p.image_path),
    };
  });
}

const ERRORS: [RegExp, string][] = [
  [/INSUFFICIENT_STOCK/, "Algum item acabou de esgotar ou não tem a quantidade pedida. Revise a sacola."],
  [/ITEM_UNAVAILABLE/, "Algum item não está mais disponível. Revise a sacola."],
  [/STORE_NOT_FOUND/, "Esta loja não está disponível no momento."],
  [/INVALID_PHONE/, "Telefone inválido. Use DDD + número."],
  [/INVALID_NAME/, "Informe seu nome."],
  [/INVALID_QUANTITY/, "Quantidade inválida em algum item."],
  [/EMPTY_CART|TOO_MANY_ITEMS/, "Confira os itens da sacola."],
];

/**
 * Cria o pedido (reserva o estoque e grava o snapshot) e devolve o link do WhatsApp.
 * IMPORTANTE: o pedido nasce como "Novo" — não pago e não confirmado. O envio da
 * mensagem é feito pelo cliente no WhatsApp; o sistema não sabe se ela foi entregue.
 */
export async function placeOrder(input: unknown): Promise<ActionState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const o = parsed.data;

  const ip = await clientIp();
  if (!rateLimit(`order:${ip}`, 8, 10 * 60_000) || !rateLimit(`order:${o.slug}:${o.phone}`, 5, 60 * 60_000)) {
    return fail("Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.");
  }

  // agrega duplicatas por variação
  const merged = new Map<string, number>();
  for (const it of o.items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.quantity);
  const items = [...merged].map(([variant_id, quantity]) => ({ variant_id, quantity }));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("place_order", {
    p_tenant_slug: o.slug, p_customer_name: o.name, p_customer_phone: o.phone,
    p_customer_email: o.email ?? null, p_notes: o.notes ?? null, p_items: items,
  });
  if (error) {
    const known = ERRORS.find(([re]) => re.test(error.message));
    return fail(known ? known[1] : "Não foi possível registrar o pedido. Tente novamente.");
  }

  const order = data as OrderSnapshot & { order_id: string };
  const message = buildWhatsAppMessage(order, o.name, o.notes);
  const url = whatsappUrl(order.whatsapp, message);
  return success(
    url
      ? `Pedido #${order.order_number} registrado! Falta só enviar a mensagem no WhatsApp para a loja confirmar.`
      : `Pedido #${order.order_number} registrado! A loja ainda não configurou o WhatsApp — entre em contato com ela informando este número.`,
    { orderNumber: order.order_number, total: order.total, whatsappUrl: url },
  );
}
