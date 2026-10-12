import type { Metadata } from "next";
import { requireTenant } from "@/lib/auth/context";
import { SettingsForm } from "@/components/admin/forms";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await requireTenant(["owner", "admin"]);
  if (!ctx.settings) return <Alert kind="error">Configurações da loja não encontradas. Fale com a Vexxa360°.</Alert>;
  return (
    <>
      <PageHeader title="Configurações" description="Atendimento, entrega, políticas, estoque e publicação da loja." />
      <SettingsForm s={ctx.settings} />
    </>
  );
}
