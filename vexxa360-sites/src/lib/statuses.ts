export const ORDER_STATUSES = [
  { value: "new", label: "Novo", tone: "blue" },
  { value: "awaiting_confirmation", label: "Aguardando confirmação", tone: "amber" },
  { value: "confirmed", label: "Confirmado", tone: "green" },
  { value: "preparing", label: "Em preparação", tone: "violet" },
  { value: "shipped", label: "Enviado", tone: "sky" },
  { value: "completed", label: "Concluído", tone: "emerald" },
  { value: "cancelled", label: "Cancelado", tone: "red" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export const statusLabel = (v: string) => ORDER_STATUSES.find((s) => s.value === v)?.label ?? v;
export const statusTone = (v: string) => ORDER_STATUSES.find((s) => s.value === v)?.tone ?? "gray";
export const REVENUE_STATUSES: OrderStatus[] = ["confirmed", "preparing", "shipped", "completed"];
