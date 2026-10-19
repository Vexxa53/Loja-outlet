"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { favoriteProducts } from "@/app/actions/favorites";
import type { CardProduct } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/components/store/favorites";

export function FavoritesView() {
  const ids = useFavorites();
  const key = ids.join(",");
  const [items, setItems] = useState<CardProduct[] | null>(null);
  useEffect(() => {
    let live = true;
    favoriteProducts(key ? key.split(",") : []).then((r) => { if (live) setItems(r); });
    return () => { live = false; };
  }, [key]);
  if (items === null) return <p role="status" className="text-mute">Carregando seus favoritos...</p>;
  const shown = items.filter((p) => ids.includes(p.id));
  if (!shown.length) return (
    <div className="card space-y-3 p-8 text-center"><p className="text-lg font-semibold">Você ainda não favoritou nenhum produto</p>
      <p className="text-sm text-mute">Toque no coração dos produtos para guardá-los aqui. Os favoritos ficam salvos neste aparelho.</p><Link href="/produtos" className="btn">Ver produtos</Link></div>
  );
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
