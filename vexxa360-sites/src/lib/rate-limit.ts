// Limitador em memória (por instância). Em serverless cada instância tem seu contador:
// reduz abuso casual, mas NÃO substitui um limitador distribuído (ex.: Upstash/Vercel WAF).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** Variante "só falhas": consulta sem consumir… */
export function isRateLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return !!b && b.resetAt > Date.now() && b.count >= limit;
}

/** …e registra uma falha (usada no login: acertos não contam). */
export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count += 1;
}
