import type { Metadata } from "next";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { brMoneyInput, fmtDate, toBrLocalInput } from "@/lib/data/admin";
import { formatBRL } from "@/lib/money";
import { deletePromotion, togglePromotion, updateProductPrices } from "@/lib/actions/catalog";
import { PromotionForm } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Flash, PageHeader, tableCls } from "@/components/ui";

export const metadata: Metadata = { title: "Preços e promoções" };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant(["owner", "admin"]);
  const supabase = await createClient();
  const [{ data: promos }, { data: products }] = await Promise.all([
    supabase.from("promotions").select("*").eq("tenant_id", ctx.tenantId).order("starts_at", { ascending: false }),
    supabase.from("products").select("id, name, regular_price, promotional_price").eq("tenant_id", ctx.tenantId).is("archived_at", null).order("name").limit(500),
  ]);
  const now = Date.now();
  const pName = new Map((products ?? []).map((p: any) => [p.id, p.name]));
  const valueLabel = (p: any) => p.discount_type === "percent" ? `${Number(p.discount_value)}% off` : p.discount_type === "amount_off" ? `${formatBRL(p.discount_value)} off` : `por ${formatBRL(p.discount_value)}`;
  const state = (p: any) => !p.active ? <Badge>Pausada</Badge> : now < +new Date(p.ends_at) ? (now >= +new Date(p.starts_at) ? <Badge tone="green">No ar agora</Badge> : <Badge tone="blue">Agendada</Badge>) : <Badge>Encerrada</Badge>;
  const nowInput = toBrLocalInput(new Date());

  return (
    <>
      <PageHeader title="Preços e promoções" description="Campanhas programadas entram e saem do ar sozinhas. O preço que o cliente vê é sempre o mais baixo válido no momento." />
      <Flash ok={sp.ok} erro={sp.erro} />

      <Card className="mb-8">
        <h2 className="mb-4 font-serif text-xl">Nova campanha</h2>
        <PromotionForm products={(products ?? []).map((p: any) => ({ id: p.id, name: p.name, price: formatBRL(p.regular_price) }))} />
        <p className="mt-3 text-xs text-muted">Horário atual de Brasília: {nowInput.replace("T", " ")}. Pedidos já feitos mantêm o preço da época. Cupons de desconto ainda não estão disponíveis (previsto para uma próxima versão).</p>
      </Card>

      <h2 className="mb-3 font-serif text-xl">Campanhas</h2>
      {(promos ?? []).length === 0 ? <EmptyState title="Nenhuma campanha criada" /> : (
        <div className={`${tableCls.wrap} mb-10`}>
          <table className={tableCls.table}>
            <thead><tr>{["Campanha", "Produto", "Desconto", "Vigência", "Situação", ""].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(promos ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className={`${tableCls.td} font-medium`}>{p.name}</td>
                  <td className={tableCls.td}>{p.product_id ? pName.get(p.product_id) ?? "—" : "Toda a loja"}</td>
                  <td className={tableCls.td}>{valueLabel(p)}</td>
                  <td className={`${tableCls.td} text-xs`}>{fmtDate(p.starts_at)}<br />até {fmtDate(p.ends_at)}</td>
                  <td className={tableCls.td}>{state(p)}</td>
                  <td className={`${tableCls.td} space-x-3 text-right`}>
                    <form action={togglePromotion} className="inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><button className="text-sm underline">{p.active ? "Pausar" : "Ativar"}</button></form>
                    <form action={deletePromotion} className="inline"><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Excluir esta campanha?">Excluir</ConfirmButton></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-1 font-serif text-xl">Preços dos produtos</h2>
      <p className="mb-3 text-sm text-muted">Edição rápida do preço de venda e do preço promocional permanente (sem data de término).</p>
      {(products ?? []).length === 0 ? <EmptyState title="Sem produtos para precificar" /> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead><tr>{["Produto", "Preço de venda (R$)", "Promocional (R$)", ""].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(products ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className={tableCls.td}>{p.name}</td>
                  <td className={tableCls.td} colSpan={3}>
                    <form action={updateProductPrices} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="regularPrice" defaultValue={brMoneyInput(p.regular_price)} inputMode="decimal" aria-label={`Preço de venda de ${p.name}`} className="field w-32 py-1.5" />
                      <input name="promotionalPrice" defaultValue={brMoneyInput(p.promotional_price)} inputMode="decimal" aria-label={`Preço promocional de ${p.name}`} placeholder="—" className="field w-32 py-1.5" />
                      <SubmitButton variant="secondary" className="py-1.5">Salvar</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
