import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Chave de criptografia dos segredos guardados no banco. PAYMENTS_ENCRYPTION_KEY tem prioridade; senão deriva do AUTH_SECRET. */
function key(): Buffer {
  const base = process.env.PAYMENTS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!base) throw new Error("Defina AUTH_SECRET (ou PAYMENTS_ENCRYPTION_KEY) para guardar credenciais com segurança.");
  return createHash("sha256").update(`payments:${base}`).digest();
}

/** AES-256-GCM. Formato: v1.iv.tag.dados (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(blob: string): string | null {
  try {
    const [v, iv, tag, data] = blob.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null; // chave trocada ou dado adulterado
  }
}
