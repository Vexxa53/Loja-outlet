import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, Package, ShoppingBag, Tag, Truck, CheckCircle2 } from "lucide-react";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/types/db";
import { Alert, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";
import { formatBRL } from "@/lib/money";

const PERIODS = [
  { key: "7", label: "7 dias" }, { key: "30", label: "30 dias" }, { key: "90", label: "90 dias" }, { key: "mes", label: "Este mês" },
];

function range(key: string) {
  const to = new Date(Date.now() + 60_000);
  let from: Date;
  if (key === "mes") { const n = new Date(); from = new Date(n.getFullYear(), n.getMonth(), 1); }
  else from = new Date(Date.now() - Number(key) * 86_400_000);
  return { from, to };
}

function Stat({ icon: Icon, label, value, hint, tone, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; hint?: string; tone?: "warn" | "ok"; href?: string }) {
  const body = (
    <Card className={cn("h-full transition", href && "hover:border-ink")}>
      <div className="flex items-center gap-2 text-sm text-muted"><Icon className={cn("size-4", tone === "warn" && "text-amber-600")} />{label}</div>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periodo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant();
  const periodo = PERIODS.some((p) => p.key === sp.periodo) ? sp.periodo! : "30";
  const { from, to } = range(periodo);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", { p_tenant: ctx.tenantId, p_from: from.toISOString(), p_to: to.toISOString() });
  const s = (data ?? null) as DashboardStats | null;

  return (
    <>
      <PageHeader title="Visão geral" description={`Dados reais de ${ctx.settings?.store_name ?? ctx.tenant.name}.`}
        actions={<LinkButton href="/admin/produtos/novo">Novo produto</LinkButton>} />
      {sp.erro === "permissao" && <div className="mb-4"><Alert kind="error">Seu perfil não tem permissão para acessar essa área.</Alert></div>}
      {error && <Alert kind="error">Não foi possível carregar os indicadores.</Alert>}

      {!ctx.settings?.published && (
        <div className="mb-6"><Alert kind="info">Sua loja está <strong>oculta</strong> para o público. Quando estiver pronta, publique em <Link className="underline" href="/admin/configuracoes">Configurações</Link>.</Alert></div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        <span className="text-sm text-muted">Período dos pedidos:</span>
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/admin?periodo=${p.key}`} aria-current={p.key === periodo ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", p.key === periodo ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>{p.label}</Link>
        ))}
      </div>

      {s && s.total_products === 0 ? (
        <EmptyState title="Sua loja ainda não tem produtos" action={<LinkButton href="/admin/produtos/novo">Cadastrar primeiro produto</LinkButton>}>
          Cadastre uma peça com fotos, cores, tamanhos e estoque. Depois publique para ela aparecer na vitrine.
        </EmptyState>
      ) : s ? (
        <>
          <h2 className="label">Catálogo</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat icon={Package} label="Produtos" value={s.total_products} href="/admin/produtos" />
            <Stat icon={CheckCircle2} label="Publicados" value={s.published_products} tone="ok" href="/admin/produtos" />
            <Stat icon={Tag} label="Em promoção" value={s.promo_products} href="/admin/promocoes" />
            <Stat icon={AlertTriangle} label="Estoque baixo" value={s.low_stock_products} tone={s.low_stock_products ? "warn" : undefined} href="/admin/estoque" />
            <Stat icon={Boxes} label="Esgotados" value={s.out_of_stock_products} tone={s.out_of_stock_products ? "warn" : undefined} href="/admin/estoque" />
          </div>

          <h2 className="label">Pedidos no período</h2>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={ShoppingBag} label="Novos" value={s.orders_new} href="/admin/pedidos?status=new" />
            <Stat icon={Truck} label="Em andamento" value={s.orders_in_progress} href="/admin/pedidos" />
            <Stat icon={CheckCircle2} label="Concluídos" value={s.orders_completed} href="/admin/pedidos?status=completed" />
            <Stat icon={CircleDollarSign} label="Faturamento" value={formatBRL(s.revenue)} hint="Soma de pedidos confirmados, em preparação, enviados e concluídos. Pedidos novos, aguardando e cancelados não entram." />
          </div>

          <Card>
            <h2 className="font-serif text-xl">Mais vendidos</h2>
            {s.top_products.length ? (
              <ol className="mt-3 divide-y divide-line">
                {s.top_products.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between py-2.5 text-sm"><span>{i + 1}. {p.name}</span><span className="text-muted">{p.quantity} un. · {formatBRL(p.revenue)}</span></li>
                ))}
              </ol>
            ) : <p className="mt-2 text-sm text-muted">Ainda não há vendas confirmadas neste período.</p>}
          </Card>
        </>
      ) : null}
    </>
  );
}
