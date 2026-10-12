/** Evita open-redirect: só aceita caminhos internos. */
export function safeNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
