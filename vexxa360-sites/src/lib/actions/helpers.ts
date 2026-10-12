import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authorize, type TenantContext } from "../auth/context";
import type { Role } from "@/types/db";
import { fail, type ActionState } from "../validation/common";

type PgLike = { code?: string; message?: string } | null | undefined;

/** Traduz erros do Postgres/PostgREST em mensagens claras (sem vazar detalhes internos). */
export function dbMessage(error: PgLike, fallback = "Não foi possível salvar. Tente novamente."): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  const known: [RegExp, string][] = [
    [/NEGATIVE_STOCK/, "O estoque não pode ficar negativo."],
    [/ORDER_TERMINAL/, "Pedidos concluídos ou cancelados não podem mudar de status."],
    [/ORDER_NOT_FOUND|VARIANT_NOT_FOUND/, "Registro não encontrado."],
    [/FORBIDDEN|NOT_AUTHENTICATED/, "Você não tem permissão para esta operação."],
    [/products_tenant_sku_uq/, "Já existe um produto com este SKU."],
    [/variants_tenant_sku_uq/, "Já existe uma variação com este SKU."],
    [/variants_combo_uq/, "Já existe uma variação com este tamanho e cor."],
    [/categories_tenant_id_slug_key/, "Já existe uma categoria com este nome."],
    [/promotions_check|promotions_.*check/, "Promoção inválida. Confira valores e datas."],
    [/products_check|promotional_price/, "O preço promocional deve ser menor que o preço de venda."],
  ];
  for (const [re, text] of known) if (re.test(msg)) return text;
  if (error.code === "42501" || /row-level security|permission denied/.test(msg)) return "Você não tem permissão para esta operação.";
  if (error.code === "23503") return "Referência inválida: o registro relacionado não pertence a esta loja ou não existe.";
  if (error.code === "23505") return "Já existe um registro com estes dados.";
  if (error.code === "23514") return "Algum valor está fora do permitido. Confira os campos.";
  return fallback;
}

export const NOT_LOGGED = "Sua sessão expirou ou você não tem permissão. Entre novamente.";

/** Redireciona para uma página com mensagem de sucesso/erro (padrão para ações simples de botão). */
export function flash(path: string, kind: "ok" | "erro", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

export async function withTenant<T>(
  roles: Role[],
  fn: (ctx: TenantContext) => Promise<T>,
): Promise<T | ActionState> {
  const ctx = await authorize(roles);
  if (!ctx) return fail(NOT_LOGGED);
  return fn(ctx);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const WRITE: Role[] = ["owner", "admin", "staff"];
export const MANAGE: Role[] = ["owner", "admin"];
