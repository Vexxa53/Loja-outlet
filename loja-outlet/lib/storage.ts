import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_BYTES = 4 * 1024 * 1024; // limite seguro para funções serverless (4,5 MB no corpo da requisição)
export const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/** Valida pelo conteúdo real do arquivo (não confia no nome nem no tipo informado pelo navegador). */
export function validateImage(file: { size: number }, buf: Buffer): { error: string } | { type: string } {
  if (file.size === 0 || buf.length === 0) return { error: "O arquivo está vazio." };
  if (buf.length > MAX_BYTES) return { error: "A imagem tem mais de 4 MB. Reduza o tamanho e tente de novo." };
  const real = sniff(buf);
  if (!real) return { error: "Formato não aceito. Envie uma imagem JPG, PNG ou WebP." };
  return { type: real };
}

export type Uploaded = { url: string; path: string };

/** `local` só para desenvolvimento/testes (STORAGE_DRIVER=local). Em produção usa o Supabase Storage. */
const isLocal = () => process.env.STORAGE_DRIVER === "local";
export const LOCAL_DIR = path.join(process.cwd(), ".uploads");

/** Chaves novas (sb_secret_...) não são JWT: vão só em `apikey`. A chave legada (JWT) usa também Authorization. */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

export function storageConfigured(): boolean {
  return isLocal() || !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadImage(file: File, folder: string): Promise<Uploaded> {
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateImage(file, buf);
  if ("error" in v) throw new Error(v.error);
  const objectPath = `${folder.replace(/[^a-z0-9/_-]/gi, "")}/${randomUUID()}.${ALLOWED_TYPES[v.type]}`;

  if (isLocal()) {
    const dest = path.join(LOCAL_DIR, objectPath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return { url: `/uploads/${objectPath}`, path: objectPath };
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "loja";
  if (!base || !key) throw new Error("O armazenamento de imagens ainda não foi configurado (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).");
  let res: Response;
  try {
    res = await fetch(`${base}/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: { ...authHeaders(key), "Content-Type": v.type, "x-upsert": "false" },
      body: new Uint8Array(buf),
    });
  } catch {
    throw new Error("Não foi possível falar com o armazenamento de imagens. Tente de novo em instantes.");
  }
  if (!res.ok) throw new Error(`O armazenamento recusou o envio (código ${res.status}). Verifique se o bucket "${bucket}" existe e é público.`);
  return { url: `${base}/storage/v1/object/public/${bucket}/${objectPath}`, path: objectPath };
}

export async function deleteImage(objectPath: string | null | undefined) {
  if (!objectPath) return;
  if (isLocal()) {
    await rm(path.join(LOCAL_DIR, objectPath), { force: true }).catch(() => undefined);
    return;
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "loja";
  if (!base || !key) return;
  await fetch(`${base}/storage/v1/object/${bucket}/${objectPath}`, { method: "DELETE", headers: authHeaders(key) }).catch(() => undefined);
}
