import type { Metadata } from "next";
import { FavoritesView } from "./FavoritesView";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default function Page() {
  return (<div className="container-x py-8"><h1 className="h-display mb-5 text-3xl md:text-4xl">Favoritos</h1><FavoritesView /></div>);
}
