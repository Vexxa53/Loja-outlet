import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { deleteImage, storageConfigured, uploadImage } from "@/lib/storage";
import type { Permission } from "@/lib/permissions";

export const runtime = "nodejs";

const KINDS: Record<string, { perm: Permission; folder: string }> = {
  product: { perm: "products.write", folder: "products" },
  banner: { perm: "content.write", folder: "banners" },
  category: { perm: "categories.write", folder: "categories" },
  brand: { perm: "settings.write", folder: "brand" },
};

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * Upload de uma imagem por requisição (permite barra de progresso no navegador).
 *  kind=product + productId  -> cria (ou, com replaceId, substitui) uma imagem da galeria do produto
 *  kind=banner|category|brand -> só envia o arquivo e devolve { url, path } para o formulário salvar
 */
export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return fail("Sua sessão expirou. Entre novamente.", 401);
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Não foi possível ler o arquivo enviado."); }
  const kind = String(form.get("kind") ?? "");
  const rule = KINDS[kind];
  if (!rule) return fail("Tipo de envio inválido.");
  if (!admin.role.permissions.includes(rule.perm)) return fail("Você não tem permissão para enviar imagens aqui.", 403);
  if (!storageConfigured()) return fail("O armazenamento de imagens ainda não foi configurado. Avise o responsável técnico.", 503);
  if (!(await rateLimit(`upload:${admin.id}`, 120, 600))) return fail("Muitos envios em pouco tempo. Aguarde alguns minutos.", 429);
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Nenhum arquivo foi enviado.");

  try {
    if (kind === "product") {
      const productId = String(form.get("productId") ?? "");
      const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) return fail("Produto não encontrado.", 404);
      const replaceId = String(form.get("replaceId") ?? "");
      const up = await uploadImage(file, `products/${productId}`);
      if (replaceId) {
        const old = await db.productImage.findFirst({ where: { id: replaceId, productId } });
        if (!old) { await deleteImage(up.path); return fail("A imagem a substituir não foi encontrada.", 404); }
        const img = await db.productImage.update({ where: { id: old.id }, data: { url: up.url, path: up.path } });
        await deleteImage(old.path);
        await audit(admin.id, "product.image.replace", "Product", productId);
        return NextResponse.json({ ok: true, id: img.id, url: img.url, path: up.path });
      }
      const last = await db.productImage.aggregate({ where: { productId }, _max: { position: true } });
      const img = await db.productImage.create({ data: { productId, url: up.url, path: up.path, position: (last._max.position ?? -1) + 1 } });
      await audit(admin.id, "product.image.upload", "Product", productId);
      return NextResponse.json({ ok: true, id: img.id, url: img.url, path: up.path });
    }
    const up = await uploadImage(file, rule.folder);
    return NextResponse.json({ ok: true, url: up.url, path: up.path });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha no envio da imagem.");
  }
}
