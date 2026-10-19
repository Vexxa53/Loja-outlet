"use client";
import { IconHeart } from "./icons";
import { toggleFavorite, useFavorites } from "./favorites";

export function FavoriteButton({ productId, name, className = "" }: { productId: string; name: string; className?: string }) {
  const on = useFavorites().includes(productId);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remover ${name} dos favoritos` : `Favoritar ${name}`} title={on ? "Remover dos favoritos" : "Favoritar"}
      onClick={() => toggleFavorite(productId)}
      className={`grid h-11 w-11 place-items-center rounded-full bg-black/55 backdrop-blur hover:text-accent ${on ? "text-accent" : "text-white"} ${className}`}>
      <IconHeart filled={on} />
    </button>
  );
}

export function FavoritesLink() {
  const n = useFavorites().length;
  return (
    <span className="relative inline-flex">
      <IconHeart />
      {n > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-black" aria-label={`${n} favoritos`}>{n}</span>}
    </span>
  );
}
