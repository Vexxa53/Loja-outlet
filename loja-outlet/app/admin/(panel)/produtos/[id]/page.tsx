import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ProductImages } from "@/components/admin/ProductImages";
import { addVariant, deleteProduct, deleteVariant, duplicateProduct, updateVariant } from "@/app/actions/admin-products";
import { ProductForm } from "../ProductForm";

const STATUS: Record<string, string> = { PUBLISHED: "Ativo", DRAFT: "Inativo", UNAVAILABLE: "Indisponível", ARCHIVED: "Arquivado" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("products.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, categories] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ color: "asc" }, { size: "asc" }] }, images: { orderBy: { position: "asc" } } } }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  const hid = <input type="hidden" name="id" value={p.id} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-2xl">{p.name} <span className="badge">{STATUS[p.status]}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost" target="_blank" href={`/admin/produtos/${p.id}/preview`}>Pré-visualizar</Link>
          <form action={duplicateProduct}>{hid}<SubmitButton className="btn btn-ghost" pendingText="Duplicando...">Duplicar</SubmitButton></form>
          <form action={deleteProduct}>{hid}<ConfirmButton message={`Excluir "${p.name}"? Se o produto já foi vendido, ele será apenas arquivado.`}>Excluir</ConfirmButton></form>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <ProductForm categories={categories} product={p} />
      <section className="card space-y-3 p-4"><h2 className="font-bold uppercase">Fotos</h2>
        <ProductImages productId={p.id} images={p.images.map((i) => ({ id: i.id, url: i.url }))} />
      </section>
      <section className="card space-y-3 p-4"><h2 className="font-bold uppercase">Tamanhos, cores e estoque</h2>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Cor</th><th>Tam.</th><th>SKU</th><th>Estoque</th><th>Mínimo / Ativa</th><th></th></tr></thead><tbody>
          {p.variants.map((v) => (<tr key={v.id}><td>{v.color}</td><td>{v.size}</td><td>{v.sku}</td><td>{v.stock}</td>
            <td><form action={updateVariant} className="flex items-center gap-2"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="productId" value={p.id} /><input name="minStock" type="number" defaultValue={v.minStock} className="input !w-20" aria-label="Estoque mínimo" /><input type="checkbox" name="active" defaultChecked={v.active} aria-label="Ativa" className="h-5 w-5" /><SubmitButton className="btn btn-ghost" pendingText="...">Salvar</SubmitButton></form></td>
            <td><form action={deleteVariant}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="productId" value={p.id} /><ConfirmButton message="Remover esta variação?" className="inline-flex min-h-11 items-center px-2 text-mute underline">Remover</ConfirmButton></form></td></tr>))}
          {!p.variants.length && <tr><td colSpan={6} className="text-center text-mute">Nenhuma variação ainda.</td></tr>}</tbody></table></div>
        <p className="text-xs text-mute">Para alterar quantidades use o módulo Estoque (gera histórico).</p>
        <form action={addVariant} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"><input type="hidden" name="productId" value={p.id} />
          <input name="color" placeholder="Cor" aria-label="Cor" className="input" required /><input name="size" placeholder="Tamanho (P, 42, 100ml)" aria-label="Tamanho" className="input" required /><input name="sku" placeholder="SKU da variação" aria-label="SKU da variação" className="input" required />
          <input name="stock" type="number" min={0} placeholder="Estoque inicial" aria-label="Estoque inicial" defaultValue={0} className="input" /><input name="minStock" type="number" min={0} defaultValue={2} className="input" aria-label="Mínimo" /><SubmitButton pendingText="Adicionando...">Adicionar</SubmitButton></form></section>
    </div>
  );
}
