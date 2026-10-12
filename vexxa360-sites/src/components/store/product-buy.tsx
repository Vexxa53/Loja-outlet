"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "./cart";
import { cn } from "../ui";

type V = { id: string; size: string | null; color: string | null; stock_quantity: number };

export function ProductBuy({ slug, productSlug, name, image, variants }: {
  slug: string; productSlug: string; name: string; image: string | null; variants: V[];
}) {
  const cart = useCart();
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const find = (s: string | null, c: string | null) =>
    variants.find((v) => (sizes.length ? v.size === s : true) && (colors.length ? v.color === c : true));
  const selected = (sizes.length === 0 || size) && (colors.length === 0 || color) ? find(size, color) : undefined;
  const stock = selected?.stock_quantity ?? 0;
  const optionAvailable = (s: string | null, c: string | null) => (find(s, c)?.stock_quantity ?? 0) > 0;

  function add() {
    if (!selected || stock < 1) return;
    cart.add({ variantId: selected.id, quantity: qty, name, size: selected.size, color: selected.color, image, productSlug }, stock);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  const chip = (active: boolean, disabled: boolean) =>
    cn("min-w-11 rounded-full border px-4 py-2 text-sm transition", active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
      disabled && "cursor-not-allowed text-muted line-through opacity-50 hover:border-line");

  return (
    <div className="space-y-5">
      {colors.length > 0 && (
        <fieldset>
          <legend className="label">Cor{color ? `: ${color}` : ""}</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const anyStock = variants.some((v) => v.color === c && v.stock_quantity > 0 && (!size || v.size === size));
              return <button key={c} type="button" aria-pressed={color === c} disabled={!anyStock} className={chip(color === c, !anyStock)} onClick={() => { setColor(c); setQty(1); }}>{c}</button>;
            })}
          </div>
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset>
          <legend className="label">Tamanho{size ? `: ${size}` : ""}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const ok = colors.length ? (color ? optionAvailable(s, color) : variants.some((v) => v.size === s && v.stock_quantity > 0)) : optionAvailable(s, null);
              return <button key={s} type="button" aria-pressed={size === s} disabled={!ok} className={chip(size === s, !ok)} onClick={() => { setSize(s); setQty(1); }}>{s}</button>;
            })}
          </div>
        </fieldset>
      )}

      <p className="min-h-5 text-sm" aria-live="polite">
        {selected ? (stock > 0 ? (stock <= 3 ? <span className="text-danger">Restam só {stock} unidade{stock > 1 ? "s" : ""}</span> : <span className="text-muted">{stock} unidades disponíveis</span>) : <span className="text-danger">Indisponível nesta combinação</span>)
          : <span className="text-muted">Escolha {[sizes.length && !size ? "o tamanho" : "", colors.length && !color ? "a cor" : ""].filter(Boolean).join(" e ")}.</span>}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button type="button" className="size-10 rounded-full text-lg hover:bg-soft" aria-label="Diminuir quantidade" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
          <button type="button" className="size-10 rounded-full text-lg hover:bg-soft disabled:opacity-40" aria-label="Aumentar quantidade" disabled={!selected || qty >= stock} onClick={() => setQty(Math.min(stock, qty + 1))}>+</button>
        </div>
        <button type="button" onClick={add} disabled={!selected || stock < 1}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-on-brand transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          {added ? <><Check className="size-4" /> Adicionado</> : <><ShoppingBag className="size-4" /> Adicionar à sacola</>}
        </button>
      </div>
      {added && <p className="text-sm"><Link className="underline" href={`/loja/${slug}/sacola`}>Ver sacola e finalizar pelo WhatsApp →</Link></p>}
    </div>
  );
}
