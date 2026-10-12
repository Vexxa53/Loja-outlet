import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: "monthly" }];
  try {
    const supabase = await createClient(); // anon: o RLS só devolve lojas e produtos publicados
    const { data: settings } = await supabase.from("store_settings").select("tenant_id").eq("published", true);
    const ids = (settings ?? []).map((s: any) => s.tenant_id);
    if (!ids.length) return entries;
    const { data: tenants } = await supabase.from("tenants").select("id, slug").in("id", ids).eq("status", "active");
    const slugOf = new Map((tenants ?? []).map((t: any) => [t.id, t.slug]));
    for (const slug of slugOf.values()) entries.push({ url: `${base}/loja/${slug}`, changeFrequency: "daily" }, { url: `${base}/loja/${slug}/produtos`, changeFrequency: "daily" });
    const { data: products } = await supabase.from("catalog_products").select("tenant_id, slug, created_at").in("tenant_id", [...slugOf.keys()]).limit(5000);
    for (const p of products ?? []) {
      const slug = slugOf.get(p.tenant_id);
      if (slug) entries.push({ url: `${base}/loja/${slug}/produto/${p.slug}`, lastModified: p.created_at, changeFrequency: "weekly" });
    }
  } catch { /* sem banco configurado */ }
  return entries;
}
