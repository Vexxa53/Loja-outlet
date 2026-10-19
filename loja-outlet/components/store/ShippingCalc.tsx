"use client";
import { useState, useTransition } from "react";
import { quoteForProduct, type QuoteResult } from "@/app/actions/shipping";
import { brl } from "@/lib/money";

export function ShippingCalc({ productId }: { productId: string }) {
  const [zip, setZip] = useState("");
  const [r, setR] = useState<QuoteResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="border-t border-steel pt-4">
      <p className="label">Calcule o frete e o prazo</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => setR(await quoteForProduct(zip, productId))); }}>
        <label htmlFor="cep-calc" className="sr-only">CEP</label>
        <input id="cep-calc" value={zip} onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, "").slice(0, 9))} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" className="input max-w-[11rem]" />
        <button className="btn btn-ghost" disabled={pending}>{pending ? "..." : "Calcular"}</button>
      </form>
      {r && (r.ok
        ? <p role="status" className="mt-2 text-sm"><strong>{r.label}</strong>: {r.priceCents ? brl(r.priceCents) : "grátis"} · prazo de {r.days} dias úteis</p>
        : <p role="alert" className="mt-2 text-sm text-red-400">{r.message}</p>)}
    </div>
  );
}
