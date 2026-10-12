import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  let stores: { name: string; slug: string }[] = [];
  try {
    const supabase = await createClient();
    const { data: settings } = await supabase.from("store_settings").select("tenant_id, store_name").eq("published", true).limit(24);
    const ids = (settings ?? []).map((s: any) => s.tenant_id);
    const { data: tenants } = ids.length ? await supabase.from("tenants").select("id, slug").in("id", ids) : { data: [] };
    stores = (settings ?? []).map((s: any) => ({ name: s.store_name, slug: (tenants ?? []).find((t: any) => t.id === s.tenant_id)?.slug })).filter((s) => s.slug);
  } catch { /* sem Supabase configurado: mostra só a apresentação */ }

  return (
    <main className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-muted">Vexxa360° Sites</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl">Lojas virtuais de moda, com painel próprio e pedidos pelo WhatsApp.</h1>
      <p className="mt-6 max-w-xl text-lg text-muted">Cada lojista administra seus produtos, estoque, preços e pedidos sem conhecimento técnico.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">Entrar no painel</Link>
      </div>
      {stores.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 font-serif text-2xl">Lojas no ar</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stores.map((s) => <li key={s.slug}><Link href={`/loja/${s.slug}`} className="block rounded-2xl border border-line bg-white p-5 hover:border-ink">{s.name}</Link></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
