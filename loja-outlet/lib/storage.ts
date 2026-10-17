import { randomUUID } from "node:crypto";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export function validateImage(file: File, buf: Buffer): string | null {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_BYTES) return "Imagem acima de 4 MB.";
  const real = sniff(buf);
  if (!real || !TYPES[real] || real !== file.type) return "Formato inválido. Use JPG, PNG ou WebP.";
  return null;
}

export type Uploaded = { url: string; path: string };

/** Envia a imagem ao Supabase Storage (bucket público) e devolve URL persistente. */
export async function uploadImage(file: File, folder: string): Promise<Uploaded> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "loja";
  if (!base || !key) throw new Error("Armazenamento não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  const buf = Buffer.from(await file.arrayBuffer());
  const err = validateImage(file, buf);
  if (err) throw new Error(err);
  const path = `${folder.replace(/[^a-z0-9/_-]/gi, "")}/${randomUUID()}.${TYPES[file.type]}`;
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw new Error(`Falha no upload (${res.status}).`);
  return { url: `${base}/storage/v1/object/public/${bucket}/${path}`, path };
}

export async function deleteImage(path: string | null | undefined) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "loja";
  if (!path || !base || !key) return;
  await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}
