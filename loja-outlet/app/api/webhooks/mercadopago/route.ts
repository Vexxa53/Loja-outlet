import type { NextRequest } from "next/server";
import { handleMercadoPagoWebhook } from "@/lib/payments/mercadopago";

export const POST = (req: NextRequest) => handleMercadoPagoWebhook(req);
