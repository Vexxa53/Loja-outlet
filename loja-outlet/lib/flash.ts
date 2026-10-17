import { redirect } from "next/navigation";

export function go(path: string, msg?: string, error = false): never {
  const u = new URL(path, "http://x");
  if (msg) u.searchParams.set(error ? "erro" : "ok", msg);
  redirect(u.pathname + u.search);
}
