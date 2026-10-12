import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/env";
import { deleteBanner } from "@/lib/actions/catalog";
import { BannerForm } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Banners" };

export default async function BannersPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant(["owner", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("banners").select("*").eq("tenant_id", ctx.tenantId).order("sort_order").order("created_at");
  const banners = (data ?? []) as any[];
  const editing = banners.find((b) => b.id === sp.editar);
  return (
    <>
      <PageHeader title="Banners" description="Imagens grandes do topo da loja. Recomendado: formato horizontal, 1920×900 px." />
      <Flash ok={sp.ok} erro={sp.erro} />
      <Card className="mb-8">
        <h2 className="mb-4 font-serif text-xl">{editing ? `Editar “${editing.title}”` : "Novo banner"}</h2>
        <BannerForm key={editing?.id ?? "new"} banner={editing} imageUrl={mediaUrl(editing?.image_path)} />
        {editing && <Link href="/admin/banners" className="mt-3 inline-block text-sm underline">Cancelar edição</Link>}
      </Card>
      {banners.length === 0 ? <EmptyState title="Nenhum banner">Sem banners, a loja mostra o nome e a apresentação no topo.</EmptyState> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {banners.map((b) => (
            <li key={b.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-[16/7] bg-soft">{mediaUrl(b.image_path) && <Image src={mediaUrl(b.image_path)!} alt="" fill sizes="(min-width:640px) 50vw, 100vw" className="object-cover" />}</div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0"><p className="truncate font-medium">{b.title}</p><p className="text-xs text-muted">Ordem {b.sort_order}</p></div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  {b.active ? <Badge tone="green">Ativo</Badge> : <Badge>Oculto</Badge>}
                  <Link href={`/admin/banners?editar=${b.id}`} className="underline">Editar</Link>
                  <form action={deleteBanner}><input type="hidden" name="id" value={b.id} /><ConfirmButton message="Excluir este banner?">Excluir</ConfirmButton></form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
