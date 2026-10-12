"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  variantId: string; quantity: number;
  // apenas para exibir enquanto os preços reais são buscados no servidor
  name: string; size: string | null; color: string | null; image: string | null; productSlug: string;
};

type CartCtx = {
  slug: string; items: CartItem[]; count: number; ready: boolean;
  add: (item: CartItem, maxStock: number) => void;
  setQuantity: (variantId: string, q: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const key = (slug: string) => `vx-cart:${slug}`;
const MAX_QTY = 50;

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // localStorage guarda só a sacola (conveniência). Preço e estoque SEMPRE são revalidados no servidor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(slug));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setItems(parsed.filter((i) => i && typeof i.variantId === "string" && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 40));
      }
    } catch { /* storage indisponível */ }
    setReady(true);
  }, [slug]);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try { localStorage.setItem(key(slug), JSON.stringify(next)); } catch { /* ignora */ }
  }, [slug]);

  const value = useMemo<CartCtx>(() => ({
    slug, items, ready, count: items.reduce((n, i) => n + i.quantity, 0),
    add(item, maxStock) {
      const cap = Math.max(0, Math.min(maxStock, MAX_QTY));
      const existing = items.find((i) => i.variantId === item.variantId);
      if (existing) persist(items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: Math.min(cap, i.quantity + item.quantity) } : i)));
      else persist([...items, { ...item, quantity: Math.min(cap, item.quantity) }]);
    },
    setQuantity(variantId, q) {
      if (q <= 0) return persist(items.filter((i) => i.variantId !== variantId));
      persist(items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(q, MAX_QTY) } : i)));
    },
    remove: (variantId) => persist(items.filter((i) => i.variantId !== variantId)),
    clear: () => persist([]),
  }), [slug, items, ready, persist]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
}
