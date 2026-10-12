import { formatBRL } from "./money";

export type OrderSnapshot = {
  order_number: number;
  total: number;
  subtotal: number;
  discount_amount: number;
  store_name: string;
  whatsapp: string | null;
  items: { name: string; size: string | null; color: string | null; quantity: number; unit_price: number; regular_unit_price: number }[];
};

/** Mensagem montada a partir do SNAPSHOT gravado no banco (nunca de valores do navegador). */
export function buildWhatsAppMessage(order: OrderSnapshot, customerName: string, notes?: string | null): string {
  const lines: string[] = [];
  lines.push(`Olá, ${order.store_name}! Fiz o pedido *#${order.order_number}* pelo site.`);
  lines.push("");
  for (const it of order.items) {
    const variant = [it.size && `Tam. ${it.size}`, it.color].filter(Boolean).join(" · ");
    lines.push(`• ${it.quantity}x ${it.name}${variant ? ` (${variant})` : ""} — ${formatBRL(it.unit_price * it.quantity)}`);
  }
  lines.push("");
  if (order.discount_amount > 0) {
    lines.push(`Subtotal: ${formatBRL(order.subtotal)}`);
    lines.push(`Descontos: -${formatBRL(order.discount_amount)}`);
  }
  lines.push(`*Total: ${formatBRL(order.total)}*`);
  lines.push("");
  lines.push(`Nome: ${customerName}`);
  if (notes) lines.push(`Obs.: ${notes}`);
  lines.push("");
  lines.push("Aguardo a confirmação do pedido, forma de pagamento e entrega.");
  return lines.join("\n");
}

export function whatsappUrl(phoneDigits: string | null, message: string): string | null {
  if (!phoneDigits || !/^\d{10,15}$/.test(phoneDigits)) return null;
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** Normaliza telefone brasileiro digitado livremente para só dígitos com DDI 55. */
export function normalizeBrPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^\d{12,13}$/.test(d) && d.startsWith("55") ? d : /^\d{10,15}$/.test(d) ? d : null;
}
