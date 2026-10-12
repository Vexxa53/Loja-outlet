import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/data/admin";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUSES, statusLabel, statusTone } from "@/lib/statuses";
import { releaseExpired } from "@/lib/actions/orders-admin";
import { SubmitButton } from "@/components/submit-button";
import { Badge, EmptyState, Flash, PageHeader, Pagination, cn, tableCls } from "@/components/ui";

export const metadata: Metadata = { title: "Pedidos" };
const PER_PAGE = 20;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pagina?: string; ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant();
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.pagina) || 1);
  const status = ORDER_STATUSES.some((s) => s.value === sp.status) ? sp.status : undefined;

  let q = supabase.from("orders").select("*, order_items(product_name_snapshot, quantity)", { count: "exact" }).eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const term = (sp.q ?? "").trim();
  if (/^#?\d+$/.test(term)) q = q.eq("order_number", Number(term.replace("#", "")));
  else if (term) q = q.ilike("customer_name", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const qs = new URLSearchParams(Object.entries({ status, q: sp.q }).filter(([, v]) => v) as [string, string][]);
  const hrefFor = (p: number) => { const u = new URLSearchParams(qs); if (p > 1) u.set("pagina", String(p)); return `/admin/pedidos${u.size ? `?${u}` : ""}`; };

  return (
    <>
      <PageHeader title="Pedidos" description="Pedidos enviados pelo WhatsApp. Um pedido novo ainda não está pago nem confirmado: confirme com o cliente e atualize o status."
        actions={<form action={releaseExpired}><SubmitButton variant="secondary" pendingText="Verificando…">Liberar reservas expiradas</SubmitButton></form>} />
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/pedidos" className={cn("rounded-full border px-3 py-1", !status ? "border-ink bg-ink text-white" : "border-line bg-white")}>Todos</Link>
        {ORDER_STATUSES.map((s) => <Link key={s.value} href={`/admin/pedidos?status=${s.value}`} className={cn("rounded-full border px-3 py-1", status === s.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>{s.label}</Link>)}
        <form className="ml-auto" role="search">{status && <input type="hidden" name="status" value={status} />}<input name="q" defaultValue={sp.q} placeholder="Nº do pedido ou cliente" aria-label="Buscar pedido" className="field w-56 rounded-full py-2" /></form>
      </div>

      {(data ?? []).length === 0 ? <EmptyState title="Nenhum pedido encontrado">Quando um cliente finalizar uma compra pelo WhatsApp, o pedido aparece aqui.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead><tr>{["Pedido", "Data", "Cliente", "Itens", "Total", "Status", "Origem"].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data ?? []).map((o: any) => {
                const n = (o.order_items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
                return (
                  <tr key={o.id} className="hover:bg-soft/40">
                    <td className={tableCls.td}><Link href={`/admin/pedidos/${o.id}`} className="font-medium underline">#{o.order_number}</Link></td>
                    <td className={`${tableCls.td} text-xs`}>{fmtDate(o.created_at)}</td>
                    <td className={tableCls.td}>{o.customer_name}<p className="text-xs text-muted">{o.customer_phone}</p></td>
                    <td className={tableCls.td}><span title={(o.order_items ?? []).map((i: any) => `${i.quantity}x ${i.product_name_snapshot}`).join("\n")}>{n} {n === 1 ? "item" : "itens"}</span></td>
                    <td className={`${tableCls.td} font-medium`}>{formatBRL(o.total)}</td>
                    <td className={tableCls.td}><Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge></td>
                    <td className={tableCls.td}>{o.source === "whatsapp" ? "WhatsApp" : "Manual"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
