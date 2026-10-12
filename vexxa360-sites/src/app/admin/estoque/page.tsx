import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/data/admin";
import { adjustStock } from "@/lib/actions/catalog";
import { Badge, Card, EmptyState, Flash, PageHeader, tableCls } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Estoque" };
const TYPES: Record<string, string> = { initial: "Estoque inicial", entry: "Entrada", adjustment: "Ajuste", reservation: "Reserva (pedido)", return: "Devolução", loss: "Perda" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string; ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant();
  const supabase = await createClient();
  const threshold = ctx.settings?.low_stock_threshold ?? 3;

  const [{ data: vs }, { data: mv }] = await Promise.all([
    supabase.from("product_variants").select("id, size, color, sku, stock_quantity, active, products!inner(name, archived_at)").eq("tenant_id", ctx.tenantId).order("created_at").limit(2000),
    supabase.from("inventory_movements").select("id, variant_id, movement_type, quantity, reason, created_at, order_id").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(40),
  ]);
  const variants = (vs ?? []).filter((v: any) => !v.products?.archived_at) as any[];
  const label = (v: any) => `${v.products?.name ?? "—"}${v.size || v.color ? ` — ${[v.size, v.color].filter(Boolean).join(" / ")}` : ""}`;
  const names = new Map(variants.map((v) => [v.id, label(v)]));

  const term = (sp.q ?? "").trim().toLowerCase();
  let rows = variants;
  if (term) rows = rows.filter((v) => label(v).toLowerCase().includes(term) || (v.sku ?? "").toLowerCase().includes(term));
  if (sp.filtro === "baixo") rows = rows.filter((v) => v.active && v.stock_quantity > 0 && v.stock_quantity <= threshold);
  if (sp.filtro === "esgotado") rows = rows.filter((v) => v.active && v.stock_quantity === 0);
  const low = variants.filter((v) => v.active && v.stock_quantity > 0 && v.stock_quantity <= threshold).length;
  const out = variants.filter((v) => v.active && v.stock_quantity === 0).length;

  return (
    <>
      <PageHeader title="Estoque" description="Quantidade por tamanho e cor. Toda alteração fica registrada no histórico." />
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/estoque" className="rounded-full border border-line bg-white px-3 py-1 hover:border-ink">Todas ({variants.length})</Link>
        <Link href="/admin/estoque?filtro=baixo" className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1">Estoque baixo (≤ {threshold}): {low}</Link>
        <Link href="/admin/estoque?filtro=esgotado" className="rounded-full border border-red-300 bg-red-50 px-3 py-1">Esgotadas: {out}</Link>
        <form className="ml-auto" role="search"><input name="q" defaultValue={sp.q} placeholder="Buscar produto, cor, SKU" aria-label="Buscar" className="field w-64 rounded-full py-2" /></form>
      </div>

      {rows.length === 0 ? <EmptyState title="Nenhuma variação encontrada">Cadastre produtos com tamanhos e cores para controlar o estoque.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead><tr>{["Produto / variação", "Estoque", "Ajustar (+ entrada / − saída)", ""].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className={tableCls.td}><span className="font-medium">{label(v)}</span>{v.sku && <p className="text-xs text-muted">SKU {v.sku}</p>}{!v.active && <Badge>Inativa</Badge>}</td>
                  <td className={tableCls.td}>{v.stock_quantity === 0 ? <Badge tone="red">0 — esgotada</Badge> : v.stock_quantity <= threshold ? <Badge tone="amber">{v.stock_quantity} — baixo</Badge> : <span className="font-medium">{v.stock_quantity}</span>}</td>
                  <td className={tableCls.td} colSpan={2}>
                    <form action={adjustStock} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="variantId" value={v.id} />
                      <input name="delta" type="number" step={1} required aria-label="Quantidade a somar ou subtrair" placeholder="+5 / -2" className="field w-28 py-1.5" />
                      <input name="reason" maxLength={300} aria-label="Motivo" placeholder="Motivo (opcional)" className="field w-48 py-1.5" />
                      <SubmitButton variant="secondary" className="py-1.5">Aplicar</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-10">
        <h2 className="font-serif text-xl">Histórico de movimentações</h2>
        <p className="mb-3 text-sm text-muted">Últimas 40. Reservas e devoluções vêm automaticamente dos pedidos.</p>
        {(mv ?? []).length === 0 ? <p className="text-sm text-muted">Nenhuma movimentação ainda.</p> : (
          <ul className="divide-y divide-line text-sm">
            {(mv ?? []).map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><strong>{TYPES[m.movement_type] ?? m.movement_type}</strong> · {names.get(m.variant_id) ?? "variação removida"}{m.reason ? <span className="text-muted"> — {m.reason}</span> : null}</span>
                <span className="flex items-center gap-3"><span className={m.quantity > 0 ? "font-medium text-ok" : "font-medium text-danger"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span><span className="text-xs text-muted">{fmtDate(m.created_at)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
