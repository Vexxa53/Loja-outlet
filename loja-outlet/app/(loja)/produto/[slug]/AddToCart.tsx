"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/app/actions/cart";

type V = { id: string; size: string; color: string; stock: number };

export function AddToCart({ variants }: { variants: V[] }) {
  const colors = [...new Set(variants.map((v) => v.color))];
  const [color, setColor] = useState(colors[0] ?? "");
  const sizes = variants.filter((v) => v.color === color);
  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const selected = variants.find((v) => v.id === variantId);

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Cor</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button key={c} type="button" onClick={() => { setColor(c); setVariantId(""); }} className={`btn ${c === color ? "" : "btn-ghost"}`}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Tamanho</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((v) => (
            <button key={v.id} type="button" disabled={v.stock <= 0} onClick={() => setVariantId(v.id)}
              className={`btn ${v.id === variantId ? "" : "btn-ghost"} ${v.stock <= 0 ? "line-through" : ""}`} aria-pressed={v.id === variantId}>{v.size}</button>
          ))}
        </div>
        {selected && selected.stock <= 3 && <p className="mt-1 text-xs text-accent">Restam apenas {selected.stock}!</p>}
      </div>
      <div className="flex items-center gap-3">
        <label className="label !mb-0" htmlFor="qty">Qtd.</label>
        <input id="qty" type="number" min={1} max={selected?.stock || 10} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input !w-20" />
      </div>
      <button className="btn w-full md:w-auto" disabled={pending || !variantId} onClick={() => start(async () => {
        const r = await addToCart(variantId, qty);
        setMsg({ ok: r.ok, text: r.message });
        if (r.ok) router.refresh();
      })}>{pending ? "Adicionando..." : variantId ? "Adicionar ao carrinho" : "Selecione o tamanho"}</button>
      {msg && <p role="status" className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text} {msg.ok && <a href="/carrinho" className="underline">Ver carrinho</a>}</p>}
    </div>
  );
}
