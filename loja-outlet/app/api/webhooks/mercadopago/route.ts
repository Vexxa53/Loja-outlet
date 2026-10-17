import { NextRequest, NextResponse } from "next/server";
import { processPayment, verifySignature } from "@/lib/payments/mercadopago";

export async function POST(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !process.env.MP_ACCESS_TOKEN) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = String(req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? "");
  if (!dataId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ok = verifySignature({ signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id"), dataId, secret });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type") ?? body.type;
  if (type && type !== "payment") return NextResponse.json({ ok: true, ignored: true });
  try {
    const r = await processPayment(dataId);
    return NextResponse.json({ ok: true, result: r });
  } catch (e) {
    console.error("webhook mp", e instanceof Error ? e.message : "erro");
    return NextResponse.json({ error: "processing failed" }, { status: 500 }); // MP fará nova tentativa
  }
}
