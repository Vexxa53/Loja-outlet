import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/data/admin";
import { setTenantStatus } from "@/lib/actions/master";
import { signOut } from "@/lib/actions/auth";
import { TenantForm } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Painel master | Vexxa360°", robots: { index: false } };

export default async function MasterPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  await requirePlatformAdmin(); // verificação no servidor, contra a tabela platform_admins
  const admin = createAdminClient();
  const [{ data: tenants }, { data: settings }, { data: members }] = await Promise.all([
    admin.from("tenants").select("id, name, slug, status, created_at").order("created_at", { ascending: false }),
    admin.from("store_settings").select("tenant_id, published"),
    admin.from("memberships").select("tenant_id, user_id").eq("role", "owner"),
  ]);
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", (members ?? []).map((m: any) => m.user_id));
  const emailOf = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
  const pub = new Map((settings ?? []).map((s: any) => [s.tenant_id, s.published]));
  const owner = new Map((members ?? []).map((m: any) => [m.tenant_id, emailOf.get(m.user_id)]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader title="Painel master" description="Administração da plataforma Vexxa360°: cadastro e status das lojas."
        actions={<><Link href="/admin" className="rounded-full border border-line bg-white px-4 py-2 text-sm">Meu painel</Link><form action={signOut}><button className="rounded-full border border-line bg-white px-4 py-2 text-sm">Sair</button></form></>} />
      <Flash ok={sp.ok} erro={sp.erro} />
      <Card className="mb-8">
        <h2 className="mb-4 font-serif text-xl">Nova loja</h2>
        <TenantForm />
      </Card>
      <h2 className="mb-3 font-serif text-xl">Lojas ({tenants?.length ?? 0})</h2>
      <ul className="space-y-3">
        {(tenants ?? []).map((t: any) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div>
              <p className="font-medium">{t.name} <span className="text-xs text-muted">/loja/{t.slug}</span></p>
              <p className="text-xs text-muted">Lojista: {owner.get(t.id) ?? "—"} · criada em {fmtDate(t.created_at)}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {pub.get(t.id) ? <Badge tone="green">Publicada</Badge> : <Badge>Oculta</Badge>}
              {t.status === "active" ? <Badge tone="emerald">Ativa</Badge> : <Badge tone="red">Suspensa</Badge>}
              <Link href={`/loja/${t.slug}`} target="_blank" className="underline">Abrir</Link>
              <form action={setTenantStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status === "active" ? "suspended" : "active"} />
                {t.status === "active" ? <ConfirmButton message={`Suspender "${t.name}"? A vitrine e o painel dela saem do ar.`}>Suspender</ConfirmButton> : <button className="underline">Reativar</button>}</form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
