"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { deleteProductImage, moveProductImage, saveProduct, setPrimaryImage, updateImageAlt, uploadProductImage } from "@/lib/actions/products";
import { formatBRL } from "@/lib/money";
import type { ActionState } from "@/lib/validation/common";
import { Alert, Card, Field, btnClass, cn } from "../ui";
import { resizeImage } from "./image-utils";

export type ProductFormData = {
  id?: string; name: string; description: string; categoryId: string; sku: string; regularPrice: string; promotionalPrice: string;
  costPrice: string; composition: string; careInstructions: string; sizeGuide: string; weightGrams: string; lengthCm: string;
  widthCm: string; heightCm: string; tags: string; status: "draft" | "published"; featured: boolean;
};
type VariantRow = { key: string; id?: string; size: string; color: string; sku: string; stock: number; active: boolean };
type ExistingImage = { id: string; url: string; alt: string; isPrimary: boolean };
type Staged = { key: string; file: File; preview: string };

const SIZE_PRESETS: Record<string, string> = { "P · M · G · GG": "P, M, G, GG", "PP ao XG": "PP, P, M, G, GG, XG", "36 ao 44": "36, 38, 40, 42, 44", "Único": "Único" };
const uid = () => Math.random().toString(36).slice(2);
const splitList = (s: string) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];

export function ProductForm({ initial, categories, variants: initialVariants, images: initialImages, canSeeCost }: {
  initial: ProductFormData; categories: { id: string; name: string }[];
  variants: { id: string; size: string | null; color: string | null; sku: string | null; stock: number; active: boolean }[];
  images: ExistingImage[]; canSeeCost: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants.map((v) => ({ key: v.id, id: v.id, size: v.size ?? "", color: v.color ?? "", sku: v.sku ?? "", stock: v.stock, active: v.active })));
  const [sizesText, setSizesText] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [images, setImages] = useState(initialImages);
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  const [regular, setRegular] = useState(initial.regularPrice);
  const [promo, setPromo] = useState(initial.promotionalPrice);
  const fe = result.fieldErrors ?? {};
  const productId = initial.id;

  function generate() {
    const sizes = splitList(sizesText), colors = splitList(colorsText);
    const sizeList = sizes.length ? sizes : [""], colorList = colors.length ? colors : [""];
    if (!sizes.length && !colors.length) return;
    setVariants((cur) => {
      const have = new Set(cur.map((v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`));
      const add: VariantRow[] = [];
      for (const s of sizeList) for (const c of colorList) {
        if (!have.has(`${s.toLowerCase()}|${c.toLowerCase()}`)) add.push({ key: uid(), size: s, color: c, sku: "", stock: 0, active: true });
      }
      return [...cur, ...add];
    });
  }
  const patch = (key: string, p: Partial<VariantRow>) => setVariants((cur) => cur.map((v) => (v.key === key ? { ...v, ...p } : v)));

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const out: Staged[] = [];
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setImgMsg(`"${f.name}": formato não aceito (use JPG, PNG ou WebP).`); continue; }
      const small = await resizeImage(f);
      if (small.size > 4 * 1024 * 1024) { setImgMsg(`"${f.name}": maior que 4 MB.`); continue; }
      out.push({ key: uid(), file: small, preview: URL.createObjectURL(small) });
    }
    if (out.length) setImgMsg(null);
    setStaged((cur) => [...cur, ...out].slice(0, 12 - images.length));
  }

  async function imgAction(fn: () => Promise<ActionState>) {
    const r = await fn();
    setImgMsg(r.ok ? null : r.error ?? "Erro.");
    router.refresh();
    return r;
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget);
    fd.set("status", submitter?.value === "published" ? "published" : "draft");
    fd.set("variants", JSON.stringify(variants.map((v) => ({ id: v.id, size: v.size, color: v.color, sku: v.sku, stock: Number(v.stock) || 0, active: v.active }))));
    if (productId) fd.set("id", productId);
    setResult({});
    start(async () => {
      setProgress("Salvando produto…");
      const r = await saveProduct({}, fd);
      if (!r.ok) { setResult(r); setProgress(null); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      const id = String(r.data?.productId);
      const failed: string[] = [];
      for (let i = 0; i < staged.length; i++) {
        setProgress(`Enviando foto ${i + 1} de ${staged.length}…`);
        const up = new FormData();
        up.set("file", staged[i].file);
        const ur = await uploadProductImage(id, up);
        if (!ur.ok) failed.push(`${staged[i].file.name}: ${ur.error}`);
      }
      setProgress(null);
      if (failed.length) {
        setResult({ ok: false, error: `Produto salvo, mas algumas fotos falharam — ${failed.join(" · ")}` });
        setStaged([]);
        router.replace(`/admin/produtos/${id}`);
        router.refresh();
        return;
      }
      router.push(`/admin/produtos?ok=${encodeURIComponent(r.message ?? "Produto salvo.")}`);
    });
  }

  const regN = Number(regular.replace(/\./g, "").replace(",", "."));
  const promoN = Number(promo.replace(/\./g, "").replace(",", "."));
  const pct = regN > 0 && promoN > 0 && promoN < regN ? Math.round((1 - promoN / regN) * 100) : 0;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
      {result.error && <Alert kind="error">{result.error}</Alert>}

      <Card>
        <h2 className="mb-4 font-serif text-xl">Informações</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nome do produto" name="name" error={fe.name}><input id="name" name="name" defaultValue={initial.name} required maxLength={160} className="field" placeholder="Ex.: Camiseta Oversized Preta" /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição" name="description" error={fe.description}><textarea id="description" name="description" defaultValue={initial.description} rows={4} maxLength={5000} className="field" /></Field></div>
          <Field label="Categoria" name="categoryId" error={fe.categoryId}>
            <select id="categoryId" name="categoryId" defaultValue={initial.categoryId} className="field">
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="SKU (opcional)" name="sku" error={fe.sku}><input id="sku" name="sku" defaultValue={initial.sku} maxLength={60} className="field" /></Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-serif text-xl">Preços</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Preço de venda (R$)" name="regularPrice" error={fe.regularPrice}><input id="regularPrice" name="regularPrice" inputMode="decimal" value={regular} onChange={(e) => setRegular(e.target.value)} required className="field" placeholder="149,90" /></Field>
          <Field label="Preço promocional (R$)" name="promotionalPrice" error={fe.promotionalPrice} hint={pct ? `De ${formatBRL(regN)} por ${formatBRL(promoN)} (-${pct}%)` : "Deixe vazio se não houver."}>
            <input id="promotionalPrice" name="promotionalPrice" inputMode="decimal" value={promo} onChange={(e) => setPromo(e.target.value)} className="field" placeholder="99,90" />
          </Field>
          {canSeeCost && <Field label="Custo de aquisição (R$)" name="costPrice" error={fe.costPrice} hint="Privado: nunca aparece na loja."><input id="costPrice" name="costPrice" inputMode="decimal" defaultValue={initial.costPrice} className="field" /></Field>}
        </div>
        <p className="mt-3 text-xs text-muted">Para campanhas com data de início e fim, use <strong>Preços e promoções</strong> no menu.</p>
      </Card>

      <Card>
        <h2 className="mb-1 font-serif text-xl">Fotografias</h2>
        <p className="mb-4 text-sm text-muted">A primeira foto (ou a marcada com ★) é a principal. Até 12 fotos · JPG, PNG ou WebP · até 4 MB cada.</p>
        {imgMsg && <div className="mb-3"><Alert kind="error">{imgMsg}</Alert></div>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((im, i) => (
            <li key={im.id} className="rounded-xl border border-line p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.alt} className="size-full object-cover" />
                {im.isPrimary && <span className="absolute left-1 top-1 rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">Principal</span>}
              </div>
              <input defaultValue={im.alt} aria-label="Texto alternativo da foto" maxLength={200} placeholder="Descrição da foto"
                onBlur={(e) => { if (e.target.value !== im.alt) imgAction(() => updateImageAlt(im.id, e.target.value)); }} className="field mt-2 py-1.5 text-xs" />
              <div className="mt-2 flex items-center justify-between">
                <button type="button" aria-label="Definir como principal" title="Definir como principal" disabled={im.isPrimary} className="rounded p-1.5 hover:bg-soft disabled:opacity-30" onClick={() => imgAction(() => setPrimaryImage(im.id))}><Star className="size-4" /></button>
                <button type="button" aria-label="Mover para antes" disabled={i === 0} className="rounded p-1.5 hover:bg-soft disabled:opacity-30" onClick={() => imgAction(() => moveProductImage(im.id, "up"))}><ArrowUp className="size-4" /></button>
                <button type="button" aria-label="Mover para depois" disabled={i === images.length - 1} className="rounded p-1.5 hover:bg-soft disabled:opacity-30" onClick={() => imgAction(() => moveProductImage(im.id, "down"))}><ArrowDown className="size-4" /></button>
                <button type="button" aria-label="Excluir foto" className="rounded p-1.5 text-danger hover:bg-red-50" onClick={() => { if (confirm("Excluir esta foto?")) imgAction(async () => { const r = await deleteProductImage(im.id); if (r.ok) setImages((c) => c.filter((x) => x.id !== im.id)); return r; }); }}><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
          {staged.map((s) => (
            <li key={s.key} className="rounded-xl border border-dashed border-ink/40 p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="Nova foto (ainda não enviada)" className="size-full object-cover" />
                <button type="button" aria-label="Remover da lista" className="absolute right-1 top-1 rounded-full bg-white/90 p-1" onClick={() => setStaged((c) => c.filter((x) => x.key !== s.key))}><X className="size-4" /></button>
              </div>
              <p className="mt-2 text-center text-xs text-muted">Será enviada ao salvar</p>
            </li>
          ))}
          {images.length + staged.length < 12 && (
            <li>
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-center text-sm text-muted hover:border-ink">
                <span><ImagePlus className="mx-auto mb-1 size-6" />Adicionar fotos</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            </li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 font-serif text-xl">Variações e estoque</h2>
        <p className="mb-4 text-sm text-muted">Cada combinação de tamanho e cor tem estoque próprio. Para peça sem variação, gere uma linha “Único”.</p>
        {fe.variants && <div className="mb-3"><Alert kind="error">{fe.variants[0]}</Alert></div>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="sizes">Tamanhos (separe por vírgula)</label>
            <input id="sizes" value={sizesText} onChange={(e) => setSizesText(e.target.value)} className="field" placeholder="P, M, G, GG" />
          </div>
          <div>
            <label className="label" htmlFor="colors">Cores (separe por vírgula)</label>
            <input id="colors" value={colorsText} onChange={(e) => setColorsText(e.target.value)} className="field" placeholder="Preta, Branca" />
          </div>
          <button type="button" className={btnClass.secondary} onClick={generate}><Plus className="size-4" /> Gerar combinações</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(SIZE_PRESETS).map(([label, v]) => <button key={label} type="button" onClick={() => setSizesText(v)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-ink">{label}</button>)}
        </div>

        {variants.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="pb-2 pr-2">Tamanho</th><th className="pb-2 pr-2">Cor</th><th className="pb-2 pr-2">SKU</th><th className="pb-2 pr-2">Estoque</th><th className="pb-2 pr-2">Ativa</th><th /></tr></thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.key} className="border-t border-line/70">
                    <td className="py-2 pr-2"><input aria-label="Tamanho" value={v.size} onChange={(e) => patch(v.key, { size: e.target.value })} maxLength={20} className="field py-1.5" /></td>
                    <td className="py-2 pr-2"><input aria-label="Cor" value={v.color} onChange={(e) => patch(v.key, { color: e.target.value })} maxLength={40} className="field py-1.5" /></td>
                    <td className="py-2 pr-2"><input aria-label="SKU da variação" value={v.sku} onChange={(e) => patch(v.key, { sku: e.target.value })} maxLength={60} className="field py-1.5" /></td>
                    <td className="py-2 pr-2"><input aria-label="Estoque" type="number" min={0} step={1} value={v.stock} onChange={(e) => patch(v.key, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn("field w-24 py-1.5", v.stock === 0 && "border-amber-400")} /></td>
                    <td className="py-2 pr-2"><input aria-label="Variação ativa" type="checkbox" checked={v.active} onChange={(e) => patch(v.key, { active: e.target.checked })} /></td>
                    <td className="py-2"><button type="button" aria-label="Remover variação" className="rounded p-1.5 text-danger hover:bg-red-50" onClick={() => setVariants((c) => c.filter((x) => x.key !== v.key))}><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Total em estoque: <strong>{variants.filter((v) => v.active).reduce((n, v) => n + (Number(v.stock) || 0), 0)}</strong> unidades. Alterações de quantidade ficam registradas no histórico de estoque.</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-serif text-xl">Detalhes (opcional)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Composição do tecido" name="composition" error={fe.composition}><input id="composition" name="composition" defaultValue={initial.composition} maxLength={500} className="field" placeholder="100% algodão" /></Field>
          <Field label="Instruções de lavagem" name="careInstructions" error={fe.careInstructions}><input id="careInstructions" name="careInstructions" defaultValue={initial.careInstructions} maxLength={1000} className="field" placeholder="Lavar à mão, não usar alvejante" /></Field>
          <div className="sm:col-span-2"><Field label="Guia de medidas (deste produto)" name="sizeGuide" error={fe.sizeGuide} hint="Se vazio, usa o guia padrão da loja (Configurações)."><textarea id="sizeGuide" name="sizeGuide" defaultValue={initial.sizeGuide} rows={3} maxLength={4000} className="field" placeholder={"P: busto 88 cm · comprimento 62 cm\nM: busto 94 cm · comprimento 64 cm"} /></Field></div>
          <Field label="Peso (gramas)" name="weightGrams" error={fe.weightGrams}><input id="weightGrams" name="weightGrams" inputMode="numeric" defaultValue={initial.weightGrams} className="field" /></Field>
          <Field label="Tags (separe por vírgula)" name="tags" error={fe.tags}><input id="tags" name="tags" defaultValue={initial.tags} className="field" placeholder="verão, linho, casual" /></Field>
          <Field label="Comprimento (cm)" name="lengthCm" error={fe.lengthCm}><input id="lengthCm" name="lengthCm" inputMode="decimal" defaultValue={initial.lengthCm} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Largura (cm)" name="widthCm" error={fe.widthCm}><input id="widthCm" name="widthCm" inputMode="decimal" defaultValue={initial.widthCm} className="field" /></Field>
            <Field label="Altura (cm)" name="heightCm" error={fe.heightCm}><input id="heightCm" name="heightCm" inputMode="decimal" defaultValue={initial.heightCm} className="field" /></Field>
          </div>
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={initial.featured} /> Destacar na página inicial</label>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <p className="text-sm text-muted" aria-live="polite">{progress ?? (initial.status === "published" ? "Este produto está publicado." : "Rascunho: só você vê.")}</p>
        <div className="flex gap-2">
          <button type="submit" value="draft" disabled={pending} className={btnClass.secondary}>Salvar rascunho</button>
          <button type="submit" value="published" disabled={pending} className={btnClass.primary}>{pending ? "Salvando…" : "Publicar"}</button>
        </div>
      </div>
    </form>
  );
}
