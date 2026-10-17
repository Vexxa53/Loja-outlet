import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { addVariant, deleteProduct, deleteVariant, duplicateProduct, moveImage, removeImage, setProductStatus, updateVariant, uploadProductImages } from "@/app/actions/admin-products";
import { ProductForm } from "../ProductForm";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("products.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ color: "asc" }, { size: "asc" }] }, images: { orderBy: { position: "asc" } } } });
  if (!p) notFound();
  const hid = <input type="hidden" name="id" value={p.id} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="h-display text-2xl">{p.name} <span className="badge">{p.status}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost" target="_blank" href={`/admin/produtos/${p.id}/preview`}>Pré-visualizar</Link>
          {p.status !== "PUBLISHED" ? <form action={setProductStatus}>{hid}<input type="hidden" name="status" value="PUBLISHED" /><button className="btn">Publicar</button></form>
            : <form action={setProductStatus}>{hid}<input type="hidden" name="status" value="DRAFT" /><button className="btn btn-ghost">Despublicar</button></form>}
          <form action={setProductStatus}>{hid}<input type="hidden" name="status" value="ARCHIVED" /><button className="btn btn-ghost">Arquivar</button></form>
          <form action={duplicateProduct}>{hid}<button className="btn btn-ghost">Duplicar</button></form>
          <form action={deleteProduct}>{hid}<button className="btn btn-danger">Excluir</button></form></div></div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <ProductForm p={p} />
      <section className="card space-y-3 p-4"><h2 className="font-bold uppercase">Imagens</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{p.images.map((i) => (<div key={i.id} className="space-y-1">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i.url} alt={i.alt ?? ""} className="aspect-[3/4] w-full object-cover" />
          <div className="flex gap-1 text-xs"><form action={moveImage}><input type="hidden" name="id" value={i.id} /><button name="dir" value="up" className="btn btn-ghost !px-2 !py-1">←</button><button name="dir" value="down" className="btn btn-ghost !px-2 !py-1">→</button></form>
            <form action={removeImage}><input type="hidden" name="id" value={i.id} /><button className="btn btn-danger !px-2 !py-1">Remover</button></form></div></div>))}</div>
        <form action={uploadProductImages} className="flex flex-wrap items-end gap-2"><input type="hidden" name="productId" value={p.id} /><div><label className="label" htmlFor="files">Enviar (JPG/PNG/WebP, até 4 MB)</label><input id="files" type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple className="input" /></div><button className="btn">Enviar</button></form></section>
      <section className="card space-y-3 p-4"><h2 className="font-bold uppercase">Variações e estoque</h2>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Cor</th><th>Tam.</th><th>SKU</th><th>Estoque</th><th>Mínimo</th><th>Ativa</th><th></th></tr></thead><tbody>
          {p.variants.map((v) => (<tr key={v.id}><td>{v.color}</td><td>{v.size}</td><td>{v.sku}</td><td>{v.stock}</td>
            <td colSpan={2}><form action={updateVariant} className="flex items-center gap-2"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="productId" value={p.id} /><input name="minStock" type="number" defaultValue={v.minStock} className="input !w-20" aria-label="Estoque mínimo" /><input type="checkbox" name="active" defaultChecked={v.active} aria-label="Ativa" /><button className="btn btn-ghost !py-1">Salvar</button></form></td>
            <td><form action={deleteVariant}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="productId" value={p.id} /><button className="text-mute underline">Remover</button></form></td></tr>))}</tbody></table></div>
        <p className="text-xs text-mute">Para alterar quantidades use o módulo Estoque (gera histórico).</p>
        <form action={addVariant} className="grid gap-2 md:grid-cols-6"><input type="hidden" name="productId" value={p.id} />
          <input name="color" placeholder="Cor" className="input" required /><input name="size" placeholder="Tam." className="input" required /><input name="sku" placeholder="SKU da variação" className="input" required />
          <input name="stock" type="number" min={0} placeholder="Estoque inicial" defaultValue={0} className="input" /><input name="minStock" type="number" min={0} defaultValue={2} className="input" aria-label="Mínimo" /><button className="btn">Adicionar</button></form></section>
    </div>
  );
}
