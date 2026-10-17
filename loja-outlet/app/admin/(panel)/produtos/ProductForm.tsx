import { db } from "@/lib/db";
import { saveProduct } from "@/app/actions/admin-products";
import type { Product } from "@prisma/client";

const m = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export async function ProductForm({ p }: { p?: Product }) {
  const cats = await db.category.findMany({ orderBy: { position: "asc" } });
  const f = (name: string, label: string, def: string | number | null | undefined, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={def ?? ""} className="input" {...extra} /></div>
  );
  return (
    <form action={saveProduct} className="card space-y-4 p-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        {f("name", "Nome", p?.name, { required: true })}{f("sku", "SKU", p?.sku, { required: true })}{f("brand", "Marca", p?.brand)}
        <div><label className="label" htmlFor="categoryId">Categoria</label><select id="categoryId" name="categoryId" defaultValue={p?.categoryId ?? ""} className="input"><option value="">Sem categoria</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {f("cost", "Preço de custo (R$)", m(p?.costCents), { inputMode: "decimal" })}{f("price", "Preço de venda (R$)", m(p?.priceCents), { inputMode: "decimal", required: true })}
        {f("promo", "Preço promocional (R$)", m(p?.promoPriceCents), { inputMode: "decimal" })}
      </div>
      <div><label className="label" htmlFor="description">Descrição</label><textarea id="description" name="description" defaultValue={p?.description} rows={5} className="input" /></div>
      <div className="grid gap-3 md:grid-cols-4">{f("weightGrams", "Peso (g)", p?.weightGrams ?? 300, { type: "number" })}{f("lengthCm", "Comprimento (cm)", p?.lengthCm ?? 30, { type: "number" })}{f("widthCm", "Largura (cm)", p?.widthCm ?? 25, { type: "number" })}{f("heightCm", "Altura (cm)", p?.heightCm ?? 5, { type: "number" })}</div>
      <div className="grid gap-3 md:grid-cols-2">{f("seoTitle", "SEO: título", p?.seoTitle)}{f("seoDescription", "SEO: descrição", p?.seoDescription)}</div>
      <div className="flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={p?.featured} /> Destaque</label><label className="flex items-center gap-2"><input type="checkbox" name="isNew" defaultChecked={p?.isNew} /> Novidade</label></div>
      <button className="btn">Salvar produto</button>
    </form>
  );
}
