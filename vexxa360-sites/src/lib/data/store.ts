import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import type { Banner, CatalogProduct, Category, Product, ProductImage, StoreSettings, Tenant, Variant } from "@/types/db";

export const PAGE_SIZE = 12;

// O visitante (anon) só tem GRANT nestas colunas de store_settings — nunca use select("*") na vitrine.
const STORE_PUBLIC_COLUMNS =
  "id, tenant_id, store_name, description, logo_path, primary_color, secondary_color, whatsapp, contact_email, instagram, address, business_hours, shipping_info, privacy_url, terms_url, exchange_url, size_guide, seo_title, seo_description, published";

/** Loja pelo slug. O RLS já esconde lojas suspensas/não publicadas de quem não é da equipe. */
export const getStore = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("id, name, slug, status").eq("slug", slug).maybeSingle();
  if (!tenant) return null;
  const { data: settings } = await supabase.from("store_settings").select(STORE_PUBLIC_COLUMNS).eq("tenant_id", tenant.id).maybeSingle();
  if (!settings) return null;
  return { tenant: tenant as Tenant, settings: settings as StoreSettings };
});

export const getCategories = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("tenant_id", tenantId).eq("active", true).order("sort_order").order("name");
  return (data ?? []) as Category[];
});

export async function getBanners(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("banners").select("*").eq("tenant_id", tenantId).eq("active", true).order("sort_order").order("created_at");
  return (data ?? []) as Banner[];
}

export type CatalogFilters = {
  q?: string; category?: string; size?: string; color?: string; min?: number; max?: number;
  inStock?: boolean; onSale?: boolean; sort?: "novidades" | "menor-preco" | "maior-preco"; page?: number; featured?: boolean;
};

export async function listProducts(tenantId: string, f: CatalogFilters = {}, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  let q = supabase.from("catalog_products").select("*", { count: "exact" }).eq("tenant_id", tenantId);
  if (f.q) q = q.ilike("name", `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.size) q = q.contains("sizes", [f.size]);
  if (f.color) q = q.contains("colors", [f.color]);
  if (f.min !== undefined) q = q.gte("effective_price", f.min);
  if (f.max !== undefined) q = q.lte("effective_price", f.max);
  if (f.inStock) q = q.eq("in_stock", true);
  if (f.onSale) q = q.eq("on_sale", true);
  if (f.featured) q = q.eq("featured", true);
  if (f.sort === "menor-preco") q = q.order("effective_price", { ascending: true });
  else if (f.sort === "maior-preco") q = q.order("effective_price", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  const page = Math.max(1, f.page ?? 1);
  const from = (page - 1) * pageSize;
  const { data, count } = await q.range(from, from + pageSize - 1);
  return { items: (data ?? []) as CatalogProduct[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / pageSize)), page };
}

/** Tamanhos e cores existentes na loja (para montar os filtros). */
export async function getFilterOptions(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("catalog_products").select("sizes, colors").eq("tenant_id", tenantId).limit(1000);
  const sizes = new Set<string>(), colors = new Set<string>();
  for (const r of (data ?? []) as { sizes: string[]; colors: string[] }[]) {
    r.sizes.forEach((s) => sizes.add(s)); r.colors.forEach((c) => colors.add(c));
  }
  const order = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
  const sortedSizes = [...sizes].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, "pt-BR", { numeric: true });
  });
  return { sizes: sortedSizes, colors: [...colors].sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

export async function getProductPage(tenantId: string, productSlug: string) {
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("tenant_id", tenantId).eq("slug", productSlug).eq("status", "published").is("archived_at", null).maybeSingle();
  if (!product) return null;
  const [{ data: variants }, { data: images }, { data: price }, { data: category }] = await Promise.all([
    supabase.from("product_variants").select("id, product_id, tenant_id, sku, size, color, stock_quantity, active").eq("product_id", product.id).eq("active", true).order("created_at"),
    supabase.from("product_images").select("*").eq("product_id", product.id).order("is_primary", { ascending: false }).order("sort_order"),
    supabase.from("catalog_products").select("effective_price, on_sale, discount_percent").eq("id", product.id).maybeSingle(),
    product.category_id ? supabase.from("categories").select("id, name, slug").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    product: product as Product,
    variants: (variants ?? []) as Variant[],
    images: (images ?? []) as ProductImage[],
    price: { effective: Number(price?.effective_price ?? product.regular_price), onSale: !!price?.on_sale, percent: Number(price?.discount_percent ?? 0) },
    category: category as { id: string; name: string; slug: string } | null,
  };
}

export async function getRelated(tenantId: string, productId: string, categoryId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("catalog_products").select("*").eq("tenant_id", tenantId).neq("id", productId);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q.order("created_at", { ascending: false }).limit(4);
  return (data ?? []) as CatalogProduct[];
}
