/** Tipos e regras puras de pagamento (sem acesso a banco): usadas no servidor e no navegador. */
export const METHODS = ["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", OTHER: "Outro" };

export type PayStatus = "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED" | "EXPIRED";
export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  PENDING: "Aguardando pagamento", PROCESSING: "Processando", APPROVED: "Aprovado", REJECTED: "Recusado",
  CANCELLED: "Cancelado", REFUNDED: "Estornado", EXPIRED: "Expirado",
};

const NEXT: Record<PayStatus, PayStatus[]> = {
  PENDING: ["PROCESSING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"],
  APPROVED: ["REFUNDED"],
  REJECTED: [], CANCELLED: [], REFUNDED: [], EXPIRED: [],
};
export const canPaymentTransition = (from: string, to: string): boolean => NEXT[from as PayStatus]?.includes(to as PayStatus) ?? false;
export const isActivePayment = (s: string) => s === "PENDING" || s === "PROCESSING";

/** "Pedido #001" */
export const orderLabel = (n: number) => `#${String(n).padStart(3, "0")}`;

export type InstallmentOption = { n: number; perCents: number; totalCents: number };
export type InstallmentRule = { max: number; minCents: number };

/** Parcelas sem juros: a parcela nunca fica abaixo do mínimo configurado. Débito e PIX são sempre à vista. */
export function installmentOptions(totalCents: number, rule: InstallmentRule): InstallmentOption[] {
  const out: InstallmentOption[] = [];
  for (let n = 1; n <= Math.max(1, rule.max); n++) {
    const per = Math.ceil(totalCents / n);
    if (n > 1 && per < rule.minCents) break;
    out.push({ n, perCents: per, totalCents });
  }
  return out;
}

export const GATEWAYS: { id: string; label: string; installed: boolean }[] = [
  { id: "mercadopago", label: "Mercado Pago", installed: true },
  { id: "stripe", label: "Stripe", installed: false },
  { id: "pagarme", label: "Pagar.me", installed: false },
  { id: "asaas", label: "Asaas", installed: false },
  { id: "outro", label: "Outro", installed: false },
];

export const CARD_BRANDS = ["visa", "mastercard", "elo", "amex", "hipercard", "outra"] as const;
