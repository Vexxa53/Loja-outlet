import { randomUUID } from "node:crypto";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Detecta o formato real pelos primeiros bytes (não confia no nome nem no Content-Type do navegador). */
export function sniffImageType(bytes: Uint8Array): { mime: (typeof ALLOWED_IMAGE_TYPES)[number]; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return { mime: "image/webp", ext: "webp" };
  return null;
}

export type ImageCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string };

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "Arquivo vazio." };
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "A imagem excede 4 MB." };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Formato não aceito. Envie JPG, PNG ou WebP." };
  return { ok: true, mime: type.mime, ext: type.ext };
}

/** Caminho gerado SEMPRE no servidor: <tenant>/<pasta>/<id>.<ext>. */
export function buildMediaPath(tenantId: string, folder: "products" | "branding" | "banners" | "categories", ext: string, productId?: string) {
  const parts = [tenantId, folder];
  if (productId) parts.push(productId);
  parts.push(`${randomUUID()}.${ext}`);
  return parts.join("/");
}
