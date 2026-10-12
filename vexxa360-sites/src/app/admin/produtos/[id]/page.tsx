import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { brMoneyInput, getAdminCategories } from "@/lib/data/admin";
import { mediaUrl } from "@/lib/env";
import { Flash, PageHeader, btnClass } from "@/components/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  // Sempre filtra pela loja do usuário: trocar o id na URL nunca abre produto de outra loja.
  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!p) notFound();
  const [categories, { data: variants }, { data: images }, { data: cost }] = await Promise.all([
    getAdminCategories(ctx.tenantId),
    supabase.from("product_variants").select("id, size, color, sku, stock_quantity, active").eq("product_id", id).eq("tenant_id", ctx.tenantId).order("created_at"),
    supabase.from("product_images").select("id, storage_path, alt_text, is_primary, sort_order").eq("product_id", id).eq("tenant_id", ctx.tenantId).order("sort_order").order("created_at"),
    ctx.role !== "staff" ? supabase.from("product_costs").select("cost_price").eq("product_id", id).eq("tenant_id", ctx.tenantId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader title={p.name} description={p.archived_at ? "Produto arquivado." : p.status === "published" ? "Publicado na loja." : "Rascunho."}
        actions={p.status === "published" && !p.archived_at ? <Link className={btnClass.secondary} target="_blank" href={`/loja/${ctx.tenant.slug}/produto/${p.slug}`}>Ver na loja</Link> : undefined} />
      <Flash ok={sp.ok} erro={sp.erro} />
      <ProductForm
        canSeeCost={ctx.role !== "staff"}
        categories={categories.filter((c) => c.active || c.id === p.category_id).map((c) => ({ id: c.id, name: c.name }))}
        variants={(variants ?? []).map((v: any) => ({ id: v.id, size: v.size, color: v.color, sku: v.sku, stock: v.stock_quantity, active: v.active }))}
        images={(images ?? []).map((i: any) => ({ id: i.id, url: mediaUrl(i.storage_path) ?? "", alt: i.alt_text ?? "", isPrimary: i.is_primary }))}
        initial={{
          id: p.id, name: p.name, description: p.description ?? "", categoryId: p.category_id ?? "", sku: p.sku ?? "",
          regularPrice: brMoneyInput(p.regular_price), promotionalPrice: brMoneyInput(p.promotional_price), costPrice: brMoneyInput(cost?.cost_price),
          composition: p.composition ?? "", careInstructions: p.care_instructions ?? "", sizeGuide: p.size_guide ?? "",
          weightGrams: p.weight_grams?.toString() ?? "", lengthCm: p.length_cm?.toString() ?? "", widthCm: p.width_cm?.toString() ?? "", heightCm: p.height_cm?.toString() ?? "",
          tags: (p.tags ?? []).join(", "), status: p.status, featured: p.featured,
        }}
      />
    </>
  );
}
