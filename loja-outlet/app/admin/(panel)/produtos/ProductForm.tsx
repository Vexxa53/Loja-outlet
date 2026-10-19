"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin-products";
import { ProductImages } from "@/components/admin/ProductImages";
import { checkFile, uploadFile } from "@/components/admin/upload-client";

type P = {
  id: string; name: string; description: string; sku: string; brand: string | null; categoryId: string | null; status: string;
  costCents: number; priceCents: number; promoPriceCents: number | null; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  featured: boolean; isNew: boolean; seoTitle: string | null; seoDescription: string | null;
};
type Cat = { id: string; name: string };
type Staged = { key: string; file: File; preview: string; error?: string };
type Row = { key: number; size: string; color: string; stock: string };

const money = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const STATUS_LABEL: Record<string, string> = { PUBLISHED: "Ativo (aparece e pode ser comprado)", DRAFT: "Inativo (não aparece na loja)", UNAVAILABLE: "Indisponível (aparece, mas não pode ser comprado)", ARCHIVED: "Arquivado (não aparece na loja)" };

export function ProductForm({ product, categories }: { product?: P; categories: Cat[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [rows, setRows] = useState<Row[]>([{ key: 1, size: "", color: "", stock: "0" }]);
  const isNew = !product;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    if (isNew) {
      const filled = rows.filter((r) => r.size.trim() && r.color.trim());
      fd.set("variants", JSON.stringify(filled.map((r) => ({ size: r.size, color: r.color, stock: r.stock || "0" }))));
    }
    setPending(true);
    const r = await saveProductAction(fd);
    if (!r.ok || !r.id) { setPending(false); setMsg({ ok: false, text: r.error ?? "Não foi possível salvar o produto." }); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    if (r.created) {
      const valid = staged.filter((s) => !s.error && !checkFile(s.file));
      let failed = 0;
      for (let i = 0; i < valid.length; i++) {
        setProgress(`Enviando foto ${i + 1} de ${valid.length}... 0%`);
        const up = await uploadFile(valid[i].file, { kind: "product", productId: r.id }, (p) => setProgress(`Enviando foto ${i + 1} de ${valid.length}... ${p}%`));
        if (!up.ok) failed++;
      }
      setProgress(null);
      const note = failed ? `Produto criado, mas ${failed} foto(s) não foram enviadas. Envie-as abaixo.` : "Produto cadastrado com sucesso!";
      router.push(`/admin/produtos/${r.id}?${failed ? "erro" : "ok"}=${encodeURIComponent(note)}`);
      return;
    }
    setPending(false);
    setMsg({ ok: true, text: "Alterações salvas. A loja já mostra os novos dados." });
    router.refresh();
  }

  const f = (name: string, label: string, def: string | number | null | undefined, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="label">{label}</span><input name={name} defaultValue={def ?? ""} className="input" {...extra} /></label>
  );

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {f("name", "Nome do produto", product?.name, { required: true })}
        {f("sku", "Código (SKU)", product?.sku, { required: true })}
        <label className="block"><span className="label">Categoria</span>
          <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="input"><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="label">Situação na loja</span>
          <select name="status" defaultValue={product?.status ?? "DRAFT"} className="input">
            {["PUBLISHED", "DRAFT", "UNAVAILABLE", ...(product?.status === "ARCHIVED" ? ["ARCHIVED"] : [])].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        {f("price", "Preço de venda (R$)", money(product?.priceCents), { inputMode: "decimal", required: true, placeholder: "129,90" })}
        {f("promo", "Preço promocional (R$) — opcional", money(product?.promoPriceCents), { inputMode: "decimal", placeholder: "99,90" })}
        {f("cost", "Preço de custo (R$) — opcional", money(product?.costCents), { inputMode: "decimal" })}
        {f("brand", "Marca — opcional", product?.brand)}
      </div>
      <label className="block"><span className="label">Descrição completa</span><textarea name="description" defaultValue={product?.description} rows={6} className="input" /></label>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="featured" defaultChecked={product?.featured} className="h-5 w-5" /> Destaque na página inicial</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="isNew" defaultChecked={product?.isNew} className="h-5 w-5" /> Marcar como novidade</label>
      </div>
      <p className="text-xs text-mute">Se houver preço promocional, a loja mostra automaticamente o selo de desconto e o preço antigo riscado.</p>

      {isNew && (
        <>
          <div>
            <h2 className="mb-2 font-bold uppercase">Fotos do produto</h2>
            <ProductImages images={[]} staged={staged} onStage={setStaged} />
          </div>
          <div>
            <h2 className="mb-1 font-bold uppercase">Tamanhos, cores e estoque</h2>
            <p className="mb-2 text-xs text-mute">Informe ao menos uma variação para publicar (tênis: 38, 39...; perfume: 100ml; relógio: Único).</p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={r.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                  <input aria-label="Tamanho" placeholder="Tamanho (P, 42, 100ml)" value={r.size} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, size: e.target.value } : x))} className="input" />
                  <input aria-label="Cor" placeholder="Cor" value={r.color} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, color: e.target.value } : x))} className="input" />
                  <input aria-label="Estoque" type="number" min={0} placeholder="Estoque" value={r.stock} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, stock: e.target.value } : x))} className="input" />
                  <button type="button" className="btn btn-ghost" onClick={() => setRows(rows.length > 1 ? rows.filter((_, k) => k !== i) : rows)} aria-label="Remover linha">Remover</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost mt-2" onClick={() => setRows([...rows, { key: Date.now(), size: "", color: "", stock: "0" }])}>+ Adicionar variação</button>
          </div>
        </>
      )}

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Frete e SEO (opcional)</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {f("weightGrams", "Peso (g)", product?.weightGrams ?? 300, { type: "number" })}{f("lengthCm", "Comprimento (cm)", product?.lengthCm ?? 30, { type: "number" })}
          {f("widthCm", "Largura (cm)", product?.widthCm ?? 25, { type: "number" })}{f("heightCm", "Altura (cm)", product?.heightCm ?? 5, { type: "number" })}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{f("seoTitle", "SEO: título", product?.seoTitle)}{f("seoDescription", "SEO: descrição", product?.seoDescription)}</div>
      </details>

      {progress && <p role="status" className="flash">{progress}</p>}
      <button className="btn w-full sm:w-auto" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : isNew ? "Cadastrar produto" : "Salvar alterações"}</button>
    </form>
  );
}
