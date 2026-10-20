import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ProductImages } from "@/components/admin/ProductImages";
import { deleteProduct, duplicateProduct } from "@/app/actions/admin-products";
import { productFormData } from "../form-data";
import { ProductForm } from "../ProductForm";

const STATUS: Record<string, string> = { PUBLISHED: "Ativo", DRAFT: "Inativo", UNAVAILABLE: "Indisponível", ARCHIVED: "Arquivado" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const admin = await requireAdmin("products.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, { categories, grids }] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ color: "asc" }, { size: "asc" }] }, images: { orderBy: { position: "asc" } } } }),
    productFormData(),
  ]);
  if (!p) notFound();
  const hid = <input type="hidden" name="id" value={p.id} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-2xl">{p.name} <span className="badge">{STATUS[p.status]}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost" target="_blank" href={`/admin/produtos/${p.id}/preview`}>Pré-visualizar</Link>
          <form action={duplicateProduct}>{hid}<SubmitButton className="btn btn-ghost" pendingText="Duplicando...">Duplicar</SubmitButton></form>
          <form action={deleteProduct}>{hid}<ConfirmButton message={`Excluir "${p.name}"? Se o produto já foi vendido, ele será apenas arquivado.`}>Excluir</ConfirmButton></form>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <ProductForm key={p.updatedAt.toISOString()} categories={categories} grids={grids} canEditStock={admin.role.permissions.includes("stock.write")}
        imagesSlot={<ProductImages productId={p.id} images={p.images.map((i) => ({ id: i.id, url: i.url }))} />}
        product={{ ...p, variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, sku: v.sku, stock: v.stock, active: v.active })) }} />
    </div>
  );
}
