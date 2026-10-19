"use client";
import { useMemo, useSyncExternalStore } from "react";

const KEY = "outlet3k:favorites";
const EVT = "favorites-changed";

function raw(): string {
  try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

/** Favoritos ficam neste aparelho (localStorage). Não exigem conta e não são enviados a ninguém. */
export function useFavorites(): string[] {
  const s = useSyncExternalStore(subscribe, raw, () => "[]");
  return useMemo(() => { try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } }, [s]);
}

export function toggleFavorite(id: string) {
  let list: string[] = [];
  try { list = JSON.parse(raw()); } catch { /* vazio */ }
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-100);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVT));
}
