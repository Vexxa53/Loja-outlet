import "server-only";
import { createClient } from "../supabase/server";
import type { Category } from "@/types/db";

export async function getAdminCategories(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order").order("name");
  return (data ?? []) as Category[];
}

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** ISO → valor de <input type="datetime-local"> no horário de Brasília. */
export function toBrLocalInput(iso: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(iso);
  return parts.replace(" ", "T");
}

export const brMoneyInput = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : Number(v).toFixed(2).replace(".", ",");
