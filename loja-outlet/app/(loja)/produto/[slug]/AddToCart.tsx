"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart, type AddResult } from "@/app/actions/cart";
import { brl } from "@/lib/money";
import { colorStyle, sortSizes } from "@/lib/nav";

type V = { id: string; size: string; color: string; stock: number };

export function AddToCart({ variants }: { variants: V[] }) {
  const colors = [...new Set(variants.map((v) => v.color))];
  const [color, setColor] = useState(colors[0] ?? "");
  const sizes = sortSizes([...new Set(variants.filter((v) => v.color === color).map((v) => v.size))]);
  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<AddResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const selected = variants.find((v) => v.id === variantId);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!done) return;
    closeBtn.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDone(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [done]);

  const chip = "inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-sm font-semibold";
  return (
    <div className="space-y-4">
      {colors.length > 1 || colors[0] ? (
        <div>
          <p className="label">Cor: <span className="normal-case text-white">{color}</span></p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c} type="button" onClick={() => { setColor(c); setVariantId(""); }} aria-pressed={c === color} title={c}
                className={`${chip} gap-2 ${c === color ? "border-accent bg-accent text-black" : "border-line hover:border-accent"}`}>
                <span className="h-5 w-5 rounded-full border border-white/40" style={{ background: colorStyle(c) }} />{c}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="label">Tamanho</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((sz) => {
            const v = variants.find((x) => x.color === color && x.size === sz)!;
            return (
              <button key={v.id} type="button" disabled={v.stock <= 0} onClick={() => setVariantId(v.id)} aria-pressed={v.id === variantId}
                className={`${chip} ${v.id === variantId ? "border-accent bg-accent text-black" : "border-line hover:border-accent"} ${v.stock <= 0 ? "cursor-not-allowed text-mute line-through opacity-50" : ""}`}>{sz}</button>
            );
          })}
        </div>
        {selected && selected.stock <= 3 && <p className="mt-1 text-xs text-accent">Restam apenas {selected.stock}!</p>}
      </div>
      <div className="flex items-center gap-3">
        <label className="label !mb-0" htmlFor="qty">Qtd.</label>
        <input id="qty" type="number" min={1} max={selected?.stock || 10} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input !w-20" />
      </div>
      <button className="btn w-full md:w-auto md:min-w-64" disabled={pending || !variantId} onClick={() => start(async () => {
        const r = await addToCart(variantId, qty);
        setMsg(r.ok ? null : { ok: false, text: r.message });
        if (r.ok) { setDone(r); router.refresh(); }
      })}>{pending ? "Adicionando..." : variantId ? "Adicionar à sacola" : "Selecione o tamanho"}</button>
      {msg && <p role="alert" className="flash flash-err">{msg.text}</p>}

      {done?.added && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/70 md:place-items-center" onClick={() => setDone(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="added-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md border-t-4 border-accent bg-graphite p-5 md:border-t-0 md:border-l-4">
            <h2 id="added-title" className="h-display text-xl">Adicionado à sacola</h2>
            <div className="mt-3 flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {done.added.image ? <img src={done.added.image} alt="" className="h-24 w-[72px] shrink-0 object-cover" /> : <span className="h-24 w-[72px] shrink-0 bg-steel" />}
              <div className="min-w-0 text-sm"><p className="font-semibold">{done.added.name}</p><p className="text-mute">{done.added.color} · Tam. {done.added.size} · Qtd. {done.added.quantity}</p><p className="mt-1 font-bold text-accent">{brl(done.added.unitCents)}</p></div>
            </div>
            {done.cart && <p className="mt-3 border-t border-steel pt-3 text-sm">Sua sacola: <strong>{done.cart.count} item(ns)</strong> · subtotal <strong>{brl(done.cart.subtotalCents)}</strong></p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href="/carrinho" className="btn">Ir para a sacola</Link>
              <button ref={closeBtn} type="button" className="btn btn-ghost" onClick={() => setDone(null)}>Continuar comprando</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
