import type { NextRequest } from "next/server";
import { handleMercadoPagoWebhook } from "@/lib/payments/mercadopago";

/**
 * Entrada genérica de notificações automáticas dos gateways: /api/webhooks/payments/<gateway>.
 * Cada gateway tem um adaptador que valida a assinatura, consulta o pagamento na API do gateway
 * e chama applyPaymentStatus (lib/payments/service.ts). Só o Mercado Pago está instalado por enquanto.
 */
const ADAPTERS: Record<string, (req: NextRequest) => Promise<Response>> = {
  mercadopago: handleMercadoPagoWebhook,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params;
  const handler = ADAPTERS[gateway];
  if (!handler) return Response.json({ error: "gateway not installed" }, { status: 501 });
  return handler(req);
}
