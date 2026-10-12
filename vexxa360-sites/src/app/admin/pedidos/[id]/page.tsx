import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/data/admin";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUSES, statusLabel, statusTone } from "@/lib/statuses";
import { changeOrderStatus, saveOrderNotes } from "@/lib/actions/orders-admin";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, Badge, Card, Flash, PageHeader, btnClass, tableCls } from "@/components/ui";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  // filtro por tenant_id: ID de pedido de outra loja não abre (e o RLS também bloquearia)
  const { data: o } = await supabase.from("orders").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).eq("tenant_id", ctx.tenantId).order("product_name_snapshot"),
    supabase.from("order_status_history").select("*").eq("order_id", id).eq("tenant_id", ctx.tenantId).order("created_at"),
  ]);
  const terminal = o.status === "cancelled" || o.status === "completed";
  const wa = `https://wa.me/${o.customer_phone.startsWith("55") ? o.customer_phone : `55${o.customer_phone}`}?text=${encodeURIComponent(`Olá, ${o.customer_name}! Sobre o seu pedido #${o.order_number}…`)}`;

  return (
    <>
      <PageHeader title={`Pedido #${o.order_number}`} description={`Recebido em ${fmtDate(o.created_at)} · ${o.source === "whatsapp" ? "WhatsApp" : "Manual"}`}
        actions={<Link href="/admin/pedidos" className={btnClass.secondary}>Voltar</Link>} />
      <Flash ok={sp.ok} erro={sp.erro} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-serif text-xl">Itens</h2>
            <div className={tableCls.wrap}>
              <table className={tableCls.table}>
                <thead><tr>{["Produto", "Variação", "Qtd.", "Unitário", "Total"].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {(items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td className={tableCls.td}>{i.product_name_snapshot}{i.sku_snapshot && <p className="text-xs text-muted">SKU {i.sku_snapshot}</p>}</td>
                      <td className={tableCls.td}>{[i.size_snapshot, i.color_snapshot].filter(Boolean).join(" / ") || "—"}</td>
                      <td className={tableCls.td}>{i.quantity}</td>
                      <td className={tableCls.td}>{Number(i.unit_price) < Number(i.regular_unit_price) && <span className="mr-1 text-xs text-muted line-through">{formatBRL(i.regular_unit_price)}</span>}{formatBRL(i.unit_price)}</td>
                      <td className={`${tableCls.td} font-medium`}>{formatBRL(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatBRL(o.subtotal)}</dd></div>
              {Number(o.discount_amount) > 0 && <div className="flex justify-between"><dt className="text-muted">Descontos</dt><dd>-{formatBRL(o.discount_amount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatBRL(o.total)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Preços e nomes acima são os da data do pedido; não mudam se o produto for alterado depois.</p>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-xl">Histórico de status</h2>
            <ol className="space-y-2 text-sm">
              {(history ?? []).map((h: any) => (
                <li key={h.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted">{fmtDate(h.created_at)}</span>
                  {h.previous_status ? <>{statusLabel(h.previous_status)} → </> : "Pedido criado como "}<Badge tone={statusTone(h.new_status)}>{statusLabel(h.new_status)}</Badge>
                  {!h.changed_by && <span className="text-xs text-muted">(automático)</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-serif text-xl">Cliente</h2>
            <p className="font-medium">{o.customer_name}</p>
            <p className="text-sm text-muted">{o.customer_phone}</p>
            {o.customer_email && <p className="text-sm text-muted">{o.customer_email}</p>}
            {o.notes && <p className="mt-3 rounded-lg bg-soft p-3 text-sm"><strong>Obs. do cliente:</strong> {o.notes}</p>}
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btnClass.secondary} mt-4 w-full`}><MessageCircle className="size-4" /> Falar com o cliente</a>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-xl">Status</h2>
            <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
            {o.status === "new" && <div className="mt-3"><Alert kind="info">Este pedido foi gerado pelo site. Não está pago nem confirmado — confirme com o cliente.</Alert></div>}
            {terminal ? <p className="mt-3 text-sm text-muted">Pedidos {o.status === "cancelled" ? "cancelados" : "concluídos"} não podem mais mudar de status.</p> : (
              <form action={changeOrderStatus} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={o.id} />
                <label className="label" htmlFor="status">Alterar para</label>
                <select id="status" name="status" defaultValue={o.status} className="field">{ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                <p className="text-xs text-muted">Cancelar devolve as peças ao estoque.</p>
                <SubmitButton className="w-full" pendingText="Atualizando…">Atualizar status</SubmitButton>
              </form>
            )}
            {!terminal && (
              <form action={changeOrderStatus} className="mt-3 text-center"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="cancelled" />
                <ConfirmButton message="Cancelar este pedido? As peças voltam ao estoque e isso não pode ser desfeito.">Cancelar pedido</ConfirmButton></form>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-xl">Anotações internas</h2>
            <form action={saveOrderNotes} className="space-y-3">
              <input type="hidden" name="id" value={o.id} />
              <textarea name="notes" defaultValue={o.notes ?? ""} rows={3} maxLength={500} className="field" aria-label="Anotações do pedido" />
              <SubmitButton variant="secondary" pendingText="Salvando…">Salvar</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
