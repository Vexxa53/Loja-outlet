import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/auth/context";
import { mediaUrl } from "@/lib/env";
import { BrandingForm } from "@/components/admin/forms";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Personalizar minha loja" };

export default async function CustomizePage() {
  const ctx = await requireTenant(["owner", "admin"]);
  if (!ctx.settings) return <Alert kind="error">Configurações da loja não encontradas. Fale com a Vexxa360°.</Alert>;
  return (
    <>
      <PageHeader title="Personalizar minha loja" description="Nome, logotipo, cores e apresentação. A loja pública reflete as mudanças na hora, sem mexer em código."
        actions={<Link className="text-sm underline" href={`/loja/${ctx.tenant.slug}`} target="_blank">Ver minha loja ↗</Link>} />
      <BrandingForm s={ctx.settings} logoUrl={mediaUrl(ctx.settings.logo_path)} />
      <p className="mt-6 text-sm text-muted">Banner principal, categorias visíveis e produtos em destaque: use <Link className="underline" href="/admin/banners">Banners</Link>, <Link className="underline" href="/admin/categorias">Categorias</Link> (campo “Visível na loja”) e o campo “Destacar na página inicial” em cada produto. WhatsApp, horários, entrega e políticas ficam em <Link className="underline" href="/admin/configuracoes">Configurações</Link>.</p>
    </>
  );
}
