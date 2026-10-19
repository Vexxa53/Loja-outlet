import { db } from "../db";
import { decryptSecret, encryptSecret } from "../crypto";
import { GATEWAYS, METHODS, METHOD_LABEL, type InstallmentRule, type Method } from "./types";

/** Parte PÚBLICA/não secreta da configuração. Segredos ficam em "payments_secrets", sempre criptografados. */
export type PaymentConfig = {
  mode: "OFF" | "TEST" | "LIVE";
  pix: { enabled: boolean; receiverName: string; receiverCity: string; expiresMinutes: number };
  card: { creditEnabled: boolean; debitEnabled: boolean; gateway: string; publicKey: string; environment: "TEST" | "PRODUCTION"; maxInstallments: number; minInstallmentCents: number };
};

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  mode: "OFF",
  pix: { enabled: true, receiverName: "", receiverCity: "", expiresMinutes: 30 },
  card: { creditEnabled: true, debitEnabled: true, gateway: "mercadopago", publicKey: "", environment: "TEST", maxInstallments: 3, minInstallmentCents: 5000 },
};

export type SecretKey = "pixKey" | "secretKey" | "webhookSecret";
const SECRET_KEYS: SecretKey[] = ["pixKey", "secretKey", "webhookSecret"];

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const row = await db.setting.findUnique({ where: { key: "payments" } });
  const v = (row?.value ?? {}) as Partial<PaymentConfig>;
  return { mode: v.mode ?? "OFF", pix: { ...DEFAULT_PAYMENT_CONFIG.pix, ...v.pix }, card: { ...DEFAULT_PAYMENT_CONFIG.card, ...v.card } };
}

export async function savePaymentConfig(cfg: PaymentConfig) {
  await db.setting.upsert({ where: { key: "payments" }, create: { key: "payments", value: cfg as never }, update: { value: cfg as never } });
}

async function readSecretBlob(): Promise<Record<string, string>> {
  const row = await db.setting.findUnique({ where: { key: "payments_secrets" } });
  return (row?.value ?? {}) as Record<string, string>;
}

/** Só o servidor usa isto. Nunca devolva o resultado ao navegador. */
export async function getSecret(k: SecretKey): Promise<string | null> {
  const blob = await readSecretBlob();
  return blob[k] ? decryptSecret(blob[k]) : null;
}

/** Quais segredos existem (sem revelar o valor), para a tela do painel. */
export async function secretsPresent(): Promise<Record<SecretKey, boolean>> {
  const blob = await readSecretBlob();
  return Object.fromEntries(SECRET_KEYS.map((k) => [k, !!blob[k]])) as Record<SecretKey, boolean>;
}

/** value: texto = grava (criptografado); null = remove; undefined = mantém. */
export async function updateSecrets(patch: Partial<Record<SecretKey, string | null>>) {
  const blob = await readSecretBlob();
  for (const k of SECRET_KEYS) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v === null || v === "") delete blob[k]; else blob[k] = encryptSecret(v);
  }
  await db.setting.upsert({ where: { key: "payments_secrets" }, create: { key: "payments_secrets", value: blob as never }, update: { value: blob as never } });
}

/** Credenciais do Mercado Pago: variáveis de ambiente têm prioridade; senão, o que foi salvo no painel. */
export async function mpCreds(): Promise<{ token: string; webhookSecret: string | null } | null> {
  const token = process.env.MP_ACCESS_TOKEN || (await getSecret("secretKey"));
  if (!token) return null;
  return { token, webhookSecret: process.env.MP_WEBHOOK_SECRET || (await getSecret("webhookSecret")) };
}

export type IntegrationState = { label: "Não configurado" | "Modo de teste (simulação)" | "Ativo (recebimento real)"; mode: "OFF" | "TEST" | "LIVE"; reason?: string };

/** Estado efetivo: LIVE só vale se o gateway tem adaptador instalado e credencial salva. */
export async function integrationState(cfg?: PaymentConfig): Promise<IntegrationState> {
  const c = cfg ?? (await getPaymentConfig());
  if (c.mode === "TEST") return { label: "Modo de teste (simulação)", mode: "TEST" };
  if (c.mode === "LIVE") {
    const g = GATEWAYS.find((x) => x.id === c.card.gateway);
    if (!g?.installed) return { label: "Não configurado", mode: "OFF", reason: `O adaptador do gateway "${g?.label ?? c.card.gateway}" ainda não foi instalado.` };
    if (c.card.gateway === "mercadopago" && !(await mpCreds())) return { label: "Não configurado", mode: "OFF", reason: "Falta a Secret Key (Access Token) do gateway." };
    return { label: "Ativo (recebimento real)", mode: "LIVE" };
  }
  return { label: "Não configurado", mode: "OFF" };
}

export type CheckoutMethod = { method: Method; label: string; note: string | null };

/** Dados públicos usados pelo checkout. Sem nenhum segredo. */
export async function getCheckoutOptions() {
  const cfg = await getPaymentConfig();
  const state = await integrationState(cfg);
  const note = state.mode === "TEST" ? "Simulação: nenhuma cobrança real" : state.mode === "OFF" ? "Recebimento ainda não configurado" : null;
  const methods: CheckoutMethod[] = [];
  if (cfg.pix.enabled) methods.push({ method: "PIX", label: METHOD_LABEL.PIX, note });
  if (cfg.card.creditEnabled) methods.push({ method: "CREDIT_CARD", label: METHOD_LABEL.CREDIT_CARD, note });
  if (cfg.card.debitEnabled) methods.push({ method: "DEBIT_CARD", label: METHOD_LABEL.DEBIT_CARD, note });
  const rule: InstallmentRule = { max: cfg.card.maxInstallments, minCents: cfg.card.minInstallmentCents };
  return { mode: state.mode, methods, rule, pixExpiresMinutes: cfg.pix.expiresMinutes, gateway: cfg.card.gateway };
}

export const isMethod = (m: unknown): m is Method => (METHODS as readonly string[]).includes(String(m));
