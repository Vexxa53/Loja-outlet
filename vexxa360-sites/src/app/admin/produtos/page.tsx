import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal, Plus } from "lucide-react";
import { requireTenant } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { getAdminCategories } from "@/lib/data/admin";
import { mediaUrl } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import { archiveProduct, deleteProduct, duplicateProduct, setProductStatus } from "@/lib/actions/products";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, EmptyState, Flash, LinkButton, PageHeader, Pagination, tableCls } from "@/components/ui";

export const metadata: Metadata = { title: "Produtos" };
const PER_PAGE = 20;

type SP = { q?: string; categoria?: string; estoque?: string; situacao?: string; pagina?: string; ok?: string; erro?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireTenant();
  const supabase = await createClient();
  const categories = await getAdminCategories(ctx.tenantId);
  const threshold = ctx.settings?.low_stock_threshold ?? 3;

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, sku, category_id, regular_price, promotional_price, status, featured, archived_at, created_at, product_variants(stock_quantity, active), product_images(storage_path, is_primary, sort_order)")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const term = (sp.q ?? "").trim().toLowerCase();
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  let rows = (data ?? []).map((p: any) => {
    const stock = (p.product_variants ?? []).filter((v: any) => v.active).reduce((n: number, v: any) => n + v.stock_quantity, 0);
    const imgs = [...(p.product_images ?? [])].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
    return { ...p, stock, image: mediaUrl(imgs[0]?.storage_path) };
  });
  const situacao = sp.situacao ?? "ativos";
  rows = rows.filter((p) => {
    if (situacao === "arquivados") return !!p.archived_at;
    if (p.archived_at) return false;
    if (situacao === "publicados") return p.status === "published";
    if (situacao === "rascunhos") return p.status === "draft";
    return true;
  });
  if (term) rows = rows.filter((p) => p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term));
  if (sp.categoria) rows = rows.filter((p) => p.category_id === sp.categoria);
  if (sp.estoque === "baixo") rows = rows.filter((p) => p.stock > 0 && p.stock <= threshold);
  if (sp.estoque === "esgotado") rows = rows.filter((p) => p.stock === 0);
  if (sp.estoque === "ok") rows = rows.filter((p) => p.stock > threshold);

  const page = Math.max(1, Number(sp.pagina) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["pagina", "ok", "erro"].includes(k)) as [string, string][]);
  const hrefFor = (p: number) => { const u = new URLSearchParams(qs); if (p > 1) u.set("pagina", String(p)); return `/admin/produtos${u.size ? `?${u}` : ""}`; };

  return (
    <>
      <PageHeader title="Produtos" description="Cadastre, publique e organize as peças da sua loja."
        actions={<LinkButton href="/admin/produtos/novo"><Plus className="size-4" /> Novo produto</LinkButton>} />
      <Flash ok={sp.ok} erro={sp.erro} />

      <form className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <div><label className="label" htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={sp.q} placeholder="Nome ou SKU" className="field" /></div>
        <div><label className="label" htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={sp.categoria ?? ""} className="field"><option value="">Todas</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="estoque">Estoque</label>
          <select id="estoque" name="estoque" defaultValue={sp.estoque ?? ""} className="field"><option value="">Todos</option><option value="ok">Normal</option><option value="baixo">Baixo</option><option value="esgotado">Esgotado</option></select></div>
        <div><label className="label" htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao} className="field"><option value="ativos">Ativos</option><option value="publicados">Publicados</option><option value="rascunhos">Rascunhos</option><option value="arquivados">Arquivados</option></select></div>
        <div className="flex items-end"><button className="rounded-full bg-ink px-5 py-2.5 text-sm text-white">Filtrar</button></div>
      </form>

      {pageRows.length === 0 ? (
        <EmptyState title={data?.length ? "Nenhum produto com esses filtros" : "Nenhum produto cadastrado"}
          action={!data?.length ? <LinkButton href="/admin/produtos/novo">Cadastrar primeiro produto</LinkButton> : undefined}>
          {data?.length ? "Ajuste a busca ou os filtros." : "Comece cadastrando uma peça com fotos, cores, tamanhos e estoque."}
        </EmptyState>
      ) : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead><tr>{["Produto", "Categoria", "Preço", "Estoque", "Situação", ""].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {pageRows.map((p: any) => (
                <tr key={p.id}>
                  <td className={tableCls.td}>
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-soft">{p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}</div>
                      <div className="min-w-0">
                        <Link href={`/admin/produtos/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                        <p className="text-xs text-muted">{p.sku ? `SKU ${p.sku}` : "—"}{p.featured ? " · ★ destaque" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className={tableCls.td}>{p.category_id ? catName.get(p.category_id) ?? "—" : "—"}</td>
                  <td className={tableCls.td}>{p.promotional_price ? <><span className="text-xs text-muted line-through">{formatBRL(p.regular_price)}</span><br />{formatBRL(p.promotional_price)}</> : formatBRL(p.regular_price)}</td>
                  <td className={tableCls.td}>{p.stock === 0 ? <Badge tone="red">Esgotado</Badge> : p.stock <= threshold ? <Badge tone="amber">{p.stock} un. (baixo)</Badge> : `${p.stock} un.`}</td>
                  <td className={tableCls.td}>{p.archived_at ? <Badge>Arquivado</Badge> : p.status === "published" ? <Badge tone="green">Publicado</Badge> : <Badge tone="gray">Rascunho</Badge>}</td>
                  <td className={tableCls.td}>
                    <details className="relative">
                      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full hover:bg-soft" aria-label={`Ações de ${p.name}`}><MoreHorizontal className="size-4" /></summary>
                      <div className="absolute right-0 z-10 mt-1 w-48 space-y-1 rounded-xl border border-line bg-white p-2 shadow-lg">
                        <Link href={`/admin/produtos/${p.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-soft">Editar</Link>
                        {!p.archived_at && (
                          <form action={setProductStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "published" ? "draft" : "published"} />
                            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-soft">{p.status === "published" ? "Despublicar" : "Publicar"}</button></form>
                        )}
                        <form action={duplicateProduct}><input type="hidden" name="id" value={p.id} /><button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-soft">Duplicar</button></form>
                        <form action={archiveProduct}><input type="hidden" name="id" value={p.id} />{p.archived_at && <input type="hidden" name="restore" value="1" />}
                          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-soft">{p.archived_at ? "Restaurar" : "Arquivar"}</button></form>
                        {ctx.role !== "staff" && (
                          <form action={deleteProduct} className="px-3 py-2"><input type="hidden" name="id" value={p.id} />
                            <ConfirmButton message={`Excluir "${p.name}"? Se houver pedidos com este produto, ele será apenas arquivado para preservar o histórico.`}>Excluir…</ConfirmButton></form>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
