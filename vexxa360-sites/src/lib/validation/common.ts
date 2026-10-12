import { z } from "zod";
import { parseMoney } from "../money";
import { normalizeBrPhone } from "../whatsapp";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: Record<string, unknown>;
};

export const initialState: ActionState = {};

export function fail(error: string, fieldErrors?: ActionState["fieldErrors"]): ActionState {
  return { ok: false, error, fieldErrors };
}
export function success(message: string, data?: ActionState["data"]): ActionState {
  return { ok: true, message, data };
}

export function zodFail(err: z.ZodError): ActionState {
  const flat = z.flattenError(err);
  const first = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "Dados inválidos.";
  return fail(String(first), flat.fieldErrors as ActionState["fieldErrors"]);
}

/** FormData → objeto simples (último valor vence). Arquivos são ignorados. */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const optionalText = (max: number) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional());

export const requiredText = (label: string, min = 1, max = 160) =>
  z.string().trim().min(min, `${label} é obrigatório.`).max(max, `${label}: máximo de ${max} caracteres.`);

export const uuid = z.string().uuid("Identificador inválido.");
export const optionalUuid = z.preprocess(emptyToUndef, z.string().uuid("Identificador inválido.").optional());

/** Valor monetário digitado ("149,90") → number com 2 casas, ≥ 0. */
export const money = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? parseMoney(v) : v),
    z.number({ error: `${label} inválido. Use o formato 149,90.` }).min(0, `${label} não pode ser negativo.`).max(9_999_999, `${label} muito alto.`),
  );

export const optionalMoney = (label: string) =>
  z.preprocess(
    (v) => (emptyToUndef(v) === undefined ? undefined : typeof v === "string" ? parseMoney(v) : v),
    z.number({ error: `${label} inválido. Use o formato 149,90.` }).min(0, `${label} não pode ser negativo.`).max(9_999_999).optional(),
  );

export const intField = (label: string, min = 0, max = 1_000_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v)) : v),
    z.number({ error: `${label} inválido.` }).int(`${label} deve ser inteiro.`).min(min, `${label}: mínimo ${min}.`).max(max, `${label}: máximo ${max}.`),
  );

export const optionalNumber = (label: string, max = 100_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(String(v).replace(",", "."))) : v),
    z.number({ error: `${label} inválido.` }).min(0, `${label} não pode ser negativo.`).max(max).optional(),
  );

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use o formato #RRGGBB.");

export const httpsUrl = (label: string) =>
  z.preprocess(
    emptyToUndef,
    z.string().trim().max(500).refine((u) => {
      try { return new URL(u).protocol === "https:"; } catch { return false; }
    }, `${label}: informe um link começando com https://`).optional(),
  );

export const phoneBr = (label: string) =>
  z.string().trim().transform((v, ctx) => {
    const n = normalizeBrPhone(v);
    if (!n) { ctx.addIssue({ code: "custom", message: `${label} inválido. Use DDD + número.` }); return z.NEVER; }
    return n;
  });

/** "2025-03-01T10:00" (horário de Brasília, UTC-3 fixo desde 2019) → ISO UTC. */
export function brLocalToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
