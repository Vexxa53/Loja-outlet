"use client";
import { useLinkStatus } from "next/link";

/** Resposta imediata ao toque: enquanto a página do link carrega, o item mostra um brilho de "carregando". */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-white/25" /> : null;
}
