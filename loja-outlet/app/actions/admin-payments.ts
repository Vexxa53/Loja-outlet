"use server";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { go } from "@/lib/flash";
import { getPaymentConfig, savePaymentConfig, secretsPresent, updateSecrets, type PaymentConfig, type SecretKey } from "@/lib/payments/config";
import { GATEWAYS } from "@/lib/payments/types";
import { parseMoney } from "@/lib/money";

const BACK = "/admin/config/pagamentos";

/** Salva a configuração de pagamentos. Segredos: campo em branco = mantém; marcar "remover" = apaga; texto = grava criptografado. */
export async function savePaymentSettings(fd: FormData) {
  const admin = await requireAdmin("settings.write");
  const s = (k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
  const mode = s("mode", 5);
  if (!["OFF", "TEST", "LIVE"].includes(mode)) go(BACK, "Modo inválido.", true);
  const gateway = s("gateway", 30);
  if (!GATEWAYS.some((g) => g.id === gateway)) go(BACK, "Gateway inválido.", true);
  const environment = s("environment", 12) === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const max = Math.min(12, Math.max(1, Number(s("maxInstallments", 2)) || 1));
  const minInst = parseMoney(s("minInstallment", 12)) ?? 0;
  const pixMin = Math.min(1440, Math.max(5, Number(s("pixExpires", 5)) || 30));
  const prev = await getPaymentConfig();
  const cfg: PaymentConfig = {
    mode: mode as PaymentConfig["mode"],
    pix: { enabled: fd.get("pixEnabled") === "on", receiverName: s("receiverName", 60), receiverCity: s("receiverCity", 40), expiresMinutes: pixMin },
    card: { creditEnabled: fd.get("creditEnabled") === "on", debitEnabled: fd.get("debitEnabled") === "on", gateway, publicKey: s("publicKey", 300), environment, maxInstallments: max, minInstallmentCents: Math.max(0, minInst) },
  };
  const patch: Partial<Record<SecretKey, string | null>> = {};
  const changed: string[] = [];
  for (const k of ["pixKey", "secretKey", "webhookSecret"] as const) {
    const v = String(fd.get(k) ?? "").trim().slice(0, 500);
    if (fd.get(`${k}_remove`) === "on") { patch[k] = null; changed.push(`${k}:removida`); }
    else if (v) { patch[k] = v; changed.push(`${k}:atualizada`); }
  }
  try {
    await savePaymentConfig(cfg);
    await updateSecrets(patch);
  } catch (e) { go(BACK, e instanceof Error ? e.message : "Não foi possível salvar.", true); }
  // auditoria: registra QUE mudou, nunca o valor dos segredos
  await audit(admin.id, "payments.settings", "Setting", "payments", { modeFrom: prev.mode, modeTo: cfg.mode, gateway: cfg.card.gateway, environment: cfg.card.environment, credentials: changed });
  void secretsPresent;
  go(BACK, "Configurações de pagamento salvas.");
}
