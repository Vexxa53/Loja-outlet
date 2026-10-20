"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin-products";
import { ProductImages } from "@/components/admin/ProductImages";
import { checkFile, uploadFile } from "@/components/admin/upload-client";
import { colorStyle, sortSizes } from "@/lib/nav";
import { COLOR_PRESETS, isNumericSize, KIND_LABEL, KIND_RULES, normalizeColor, normalizeSize, UNIQUE_COLOR, UNIQUE_SIZE, type Kind } from "@/lib/size-grids";
import { NEED_SIZE_MSG, validateVariants } from "@/lib/variant-rules";
import { addColor, addSize, counts, fillEmptyStock, initGrid, previewSku, removeColor, removeSize, rowsToSave, setRow, sortedRows, type ExistingVariant, type GridState } from "@/lib/variant-grid";

type P = {
  id: string; name: string; description: string; sku: string; brand: string | null; categoryId: string | null; status: string;
  costCents: number; priceCents: number; promoPriceCents: number | null; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  featured: boolean; isNew: boolean; seoTitle: string | null; seoDescription: string | null; variants: ExistingVariant[];
};
type Cat = { id: string; name: string; kind: Kind };
type Staged = { key: string; file: File; preview: string; error?: string };

const money = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const STATUS_LABEL: Record<string, string> = { PUBLISHED: "Ativo (aparece e pode ser comprado)", DRAFT: "Inativo (não aparece na loja)", UNAVAILABLE: "Indisponível (aparece, mas não pode ser comprado)", ARCHIVED: "Arquivado (não aparece na loja)" };
const FORM = "product-form";
const chip = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-3 text-sm font-semibold";
const chipOn = "border-accent bg-accent text-black";
const chipOff = "border-line hover:border-accent";

function Err({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} role="alert" data-err className="mt-1 text-sm font-semibold text-red-400">{text}</p> : null;
}
function Section({ n, title, children, hint }: { n: number; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="card space-y-3 p-4" aria-labelledby={`sec-${n}`}>
      <h2 id={`sec-${n}`} className="flex items-center gap-2 font-bold uppercase"><span className="grid h-7 w-7 place-items-center bg-accent text-sm text-black">{n}</span>{title}</h2>
      {hint && <p className="text-xs text-mute">{hint}</p>}
      {children}
    </section>
  );
}

export function ProductForm({ product, categories, grids, canEditStock, imagesSlot }: {
  product?: P; categories: Cat[]; grids: Record<Kind, string[]>; canEditStock: boolean; imagesSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const isNew = !product;
  const [pending, setPending] = useState(false);
  const busy = useRef(false); // impede cadastro duplicado por clique repetido
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dirty, setDirty] = useState(false);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [status, setStatus] = useState(product?.status ?? "DRAFT");
  const [grid, setGridRaw] = useState<GridState>(() => initGrid(product?.variants ?? []));
  const setGrid = (fn: (g: GridState) => GridState) => { setGridRaw(fn); setDirty(true); };
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [fill, setFill] = useState("0");

  const cat = categories.find((c) => c.id === categoryId);
  const kind: Kind = cat?.kind ?? "outros";
  const rule = KIND_RULES[kind];
  const suggested = grids[kind];
  const sizeChips = useMemo(() => sortSizes([...new Set([...suggested, ...grid.sizes])]), [suggested, grid.sizes]);
  const colorChips = useMemo(() => [...new Set([...COLOR_PRESETS, ...grid.colors.filter((c) => c !== UNIQUE_COLOR)])], [grid.colors]);
  const c = counts(grid);
  const shoeNeedsSize = rule.requiresNumericSize && status !== "ARCHIVED" && !grid.rows.some((r) => r.active && isNumericSize(r.size));
  const nonNumericSelected = rule.requiresNumericSize ? grid.sizes.filter((s) => !isNumericSize(s)) : [];

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function addCustomSize() {
    const s = normalizeSize(customSize);
    if (!s) return;
    if (s.length > 12) return setErrors((e) => ({ ...e, sizes: "Tamanho muito longo (máx. 12 caracteres)." }));
    if (rule.requiresNumericSize && !isNumericSize(s)) return setErrors((e) => ({ ...e, sizes: "Calçado exige numeração válida (ex.: 38 ou 37.5)." }));
    setErrors((e) => { const { sizes: _s, ...rest } = e; void _s; return rest; });
    setGrid((g) => addSize(g, s)); setCustomSize("");
  }
  function addCustomColor() {
    const col = normalizeColor(customColor);
    if (!col) return;
    if (col.length > 30) return setErrors((e) => ({ ...e, colors: "Nome da cor muito longo (máx. 30 caracteres)." }));
    setGrid((g) => addColor(g, col)); setCustomColor("");
  }
  const toggleSize = (s: string) => setGrid((g) => (g.sizes.includes(s) ? removeSize(g, s) : addSize(g, s)));
  const toggleColor = (col: string) => setGrid((g) => (g.colors.includes(col) ? removeColor(g, col) : addColor(g, col)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const payload = rowsToSave(grid).map((r) => ({ key: r.key, id: r.id, size: r.size, color: r.color, sku: r.sku, stock: r.stock, loadedStock: r.loadedStock, active: r.active }));
    // feedback imediato (a validação que vale é a do servidor)
    const { issues } = validateVariants(payload, { kind, productSku: sku, strictShoe: status !== "ARCHIVED" });
    const local: Record<string, string> = {};
    for (const i of issues) local[i.rowKey ? `v:${i.rowKey}:${i.field}` : i.field] ??= i.message;
    if ((status === "PUBLISHED" || status === "UNAVAILABLE") && c.active === 0) local.variants ??= "Para publicar, ative ao menos uma variação (tamanho, cor e estoque). Ou salve como Inativo e complete depois.";
    if (Object.keys(local).length) { setErrors(local); setMsg({ ok: false, text: "Corrija os campos destacados antes de salvar." }); requestAnimationFrame(() => document.querySelector("[data-err]")?.scrollIntoView({ block: "center", behavior: "smooth" })); return; }
    setErrors({});
    fd.set("variants", JSON.stringify(payload));
    fd.set("sku", sku);
    busy.current = true; setPending(true);
    let r;
    try { r = await saveProductAction(fd); }
    catch { busy.current = false; setPending(false); setMsg({ ok: false, text: "Falha de conexão: nada foi salvo e seus dados continuam aqui. Tente novamente." }); return; }
    if (!r.ok || !r.id) {
      busy.current = false; setPending(false);
      setErrors(r.fieldErrors ?? {});
      setMsg({ ok: false, text: r.error ?? "Não foi possível salvar o produto." });
      requestAnimationFrame(() => (document.querySelector("[data-err]") ?? document.body).scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setDirty(false);
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
    // recarrega com os dados REAIS gravados (a tela é remontada com o que o servidor devolve)
    router.replace(`/admin/produtos/${r.id}?ok=${encodeURIComponent("Alterações salvas. A loja já mostra os novos dados.")}`);
    router.refresh();
    setPending(false); busy.current = false;
  }

  const f = (name: string, label: string, def: string | number | null | undefined, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} form={FORM} defaultValue={def ?? ""} className="input" aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `e-${name}` : undefined} {...extra} />
      <Err id={`e-${name}`} text={errors[name]} /></div>
  );

  return (
    <div onChange={() => setDirty(true)} className="space-y-4">
      {/* o <form> fica vazio e os campos se ligam a ele pelo atributo form="product-form": assim a galeria (que tem formulários próprios) não fica aninhada dentro de outro formulário */}
      <form id="product-form" onSubmit={onSubmit} noValidate />
      {product && <input type="hidden" name="id" value={product.id} form={FORM} />}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text}</p>}

      <Section n={1} title="Informações do produto">
        <div className="grid gap-3 md:grid-cols-2">
          {f("name", "Nome do produto", product?.name, { required: true })}
          <div><label className="label" htmlFor="f-sku">Código (SKU) do produto</label>
            <input id="f-sku" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className="input" required aria-invalid={!!errors.sku} />
            <Err id="e-sku" text={errors.sku} /></div>
          {f("brand", "Marca — opcional", product?.brand)}
        </div>
      </Section>

      <Section n={2} title="Imagens">
        {isNew ? <ProductImages images={[]} staged={staged} onStage={(s) => { setStaged(s); setDirty(true); }} /> : imagesSlot}
      </Section>

      <Section n={3} title="Categoria e subcategoria" hint="A categoria define a grade de tamanhos sugerida e se a numeração é obrigatória (calçados).">
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="f-categoryId">Categoria</label>
            <select id="f-categoryId" name="categoryId" form={FORM} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setDirty(true); }} className="input" aria-invalid={!!errors.categoryId}>
              <option value="">Sem categoria</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <Err id="e-categoryId" text={errors.categoryId} /></div>
          <p className="self-end text-sm" data-testid="kind-note">Tipo de grade: <strong className="text-accent">{KIND_LABEL[kind]}</strong></p>
        </div>
        {nonNumericSelected.length > 0 && <p className="flash" role="status">Este tipo de produto exige numeração. Os tamanhos atuais ({nonNumericSelected.join(", ")}) foram mantidos, mas não serão aceitos ao salvar: selecione numerações abaixo.</p>}
      </Section>

      <Section n={4} title="Descrição e características">
        <div><label className="label" htmlFor="f-description">Descrição completa</label><textarea id="f-description" name="description" form={FORM} defaultValue={product?.description} rows={5} className="input" /></div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="featured" form={FORM} defaultChecked={product?.featured} className="h-5 w-5" /> Destaque na página inicial</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="isNew" form={FORM} defaultChecked={product?.isNew} className="h-5 w-5" /> Marcar como novidade</label>
        </div>
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Frete e SEO (opcional)</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {f("weightGrams", "Peso (g)", product?.weightGrams ?? 300, { type: "number" })}{f("lengthCm", "Comprimento (cm)", product?.lengthCm ?? 30, { type: "number" })}
            {f("widthCm", "Largura (cm)", product?.widthCm ?? 25, { type: "number" })}{f("heightCm", "Altura (cm)", product?.heightCm ?? 5, { type: "number" })}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{f("seoTitle", "SEO: título", product?.seoTitle)}{f("seoDescription", "SEO: descrição", product?.seoDescription)}</div>
        </details>
      </Section>

      <Section n={5} title="Preços" hint="Com preço promocional, a loja mostra o selo de desconto e o preço antigo riscado.">
        <div className="grid gap-3 md:grid-cols-3">
          {f("price", "Preço de venda (R$)", money(product?.priceCents), { inputMode: "decimal", required: true, placeholder: "129,90" })}
          {f("promo", "Preço promocional (R$) — opcional", money(product?.promoPriceCents), { inputMode: "decimal", placeholder: "99,90" })}
          {f("cost", "Preço de custo (R$) — opcional", money(product?.costCents), { inputMode: "decimal" })}
        </div>
      </Section>

      <Section n={6} title="Tamanhos e cores" hint={rule.requiresNumericSize ? "Calçados: a numeração é obrigatória. Marque os números que existem para este modelo." : "Marque só o que existe para este produto. Produtos sem tamanho ou sem cor usam “Único”."}>
        <div role="group" aria-labelledby="sizes-h">
          <p id="sizes-h" className="label">Tamanhos <span className="normal-case text-white">({grid.sizes.length} selecionado{grid.sizes.length === 1 ? "" : "s"})</span></p>
          <div className="flex flex-wrap gap-2">
            {sizeChips.map((s) => <button key={s} type="button" aria-pressed={grid.sizes.includes(s)} onClick={() => toggleSize(s)} className={`${chip} ${grid.sizes.includes(s) ? chipOn : chipOff}`}>{s}</button>)}
            {rule.allowsSingle && <button type="button" aria-pressed={grid.sizes.includes(UNIQUE_SIZE)} onClick={() => toggleSize(UNIQUE_SIZE)} className={`${chip} ${grid.sizes.includes(UNIQUE_SIZE) ? chipOn : chipOff}`}>Tamanho único</button>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost !py-2" onClick={() => setGrid((g) => suggested.reduce(addSize, g))} disabled={!suggested.length}>Selecionar todos os sugeridos</button>
            <button type="button" className="btn btn-ghost !py-2" onClick={() => setGrid((g) => g.sizes.reduce(removeSize, g))} disabled={!grid.sizes.length}>Limpar seleção</button>
            <input aria-label="Adicionar tamanho personalizado" placeholder={rule.requiresNumericSize ? "Outro número (ex.: 45)" : "Outro tamanho (ex.: 3XL)"} value={customSize} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSize(); } }} className="input !w-52" />
            <button type="button" className="btn btn-ghost !py-2" onClick={addCustomSize}>Adicionar tamanho</button>
          </div>
          <Err id="e-sizes" text={errors.sizes ?? (shoeNeedsSize && Object.keys(errors).length ? NEED_SIZE_MSG : undefined)} />
        </div>

        <div role="group" aria-labelledby="colors-h" className="pt-2">
          <p id="colors-h" className="label">Cores <span className="normal-case text-white">({grid.colors.filter((x) => x !== UNIQUE_COLOR).length} selecionada{grid.colors.filter((x) => x !== UNIQUE_COLOR).length === 1 ? "" : "s"})</span></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={grid.colors.includes(UNIQUE_COLOR)} onClick={() => toggleColor(UNIQUE_COLOR)} className={`${chip} ${grid.colors.includes(UNIQUE_COLOR) ? chipOn : chipOff}`}>Sem variação de cor</button>
            {colorChips.map((col) => (
              <button key={col} type="button" aria-pressed={grid.colors.includes(col)} onClick={() => toggleColor(col)} className={`${chip} ${grid.colors.includes(col) ? chipOn : chipOff}`}>
                <span aria-hidden className="h-5 w-5 rounded-full border border-white/40" style={{ background: colorStyle(col) }} />{col}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input aria-label="Adicionar cor personalizada" placeholder="Nova cor (ex.: Verde-militar)" value={customColor} onChange={(e) => setCustomColor(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomColor(); } }} className="input !w-60" />
            <button type="button" className="btn btn-ghost !py-2" onClick={addCustomColor}>Adicionar cor</button>
          </div>
          <Err id="e-colors" text={errors.colors} />
        </div>
      </Section>

      <Section n={7} title="Variações e estoque" hint="Cada combinação de tamanho e cor tem o seu próprio estoque. Desmarque as combinações que não existem.">
        <p className="text-sm" aria-live="polite" data-testid="variant-count">
          <strong>{c.total}</strong> variaç{c.total === 1 ? "ão" : "ões"} serão salvas · {c.created} nova{c.created === 1 ? "" : "s"} · {c.existing} já cadastrada{c.existing === 1 ? "" : "s"} · {c.inactive} inativa{c.inactive === 1 ? "" : "s"} · estoque ativo total: <strong>{c.stock}</strong>
        </p>
        <Err id="e-variants" text={errors.variants} />
        {grid.rows.length === 0 ? (
          <p className="flash">Selecione tamanhos e cores acima para gerar as combinações.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="fill" className="text-mute">Estoque das linhas novas ainda vazias:</label>
              <input id="fill" inputMode="numeric" value={fill} onChange={(e) => setFill(e.target.value)} className="input !w-24" />
              <button type="button" className="btn btn-ghost !py-2" onClick={() => /^\d+$/.test(fill) && setGrid((g) => fillEmptyStock(g, fill))}>Aplicar</button>
            </div>
            <div role="table" aria-label="Variações e estoque" className="overflow-hidden border border-line">
              <div role="row" className="hidden grid-cols-[5rem_1fr_1.4fr_7rem_6rem] gap-2 bg-steel px-3 py-2 text-xs font-bold uppercase md:grid">
                <span role="columnheader">Tamanho</span><span role="columnheader">Cor</span><span role="columnheader">SKU</span><span role="columnheader">Estoque</span><span role="columnheader">Situação</span>
              </div>
              <ul>
                {sortedRows(grid.rows).map((r) => {
                  const ek = (f: string) => errors[`v:${r.key}:${f}`];
                  const label = `${r.size} ${r.color}`;
                  const lockStock = !!r.id && !canEditStock;
                  return (
                    <li key={r.key} role="row" data-row={`${r.size}|${r.color}`} className={`grid grid-cols-2 items-start gap-2 border-t border-line px-3 py-3 md:grid-cols-[5rem_1fr_1.4fr_7rem_6rem] ${r.active ? "" : "opacity-50"}`}>
                      <p role="cell" className="font-bold"><span className="text-xs uppercase text-mute md:hidden">Tam. </span>{r.size}</p>
                      <p role="cell"><span className="text-xs uppercase text-mute md:hidden">Cor </span>{r.color}{r.id ? <span className="badge ml-2">cadastrada</span> : <span className="badge badge-accent ml-2">nova</span>}</p>
                      <div role="cell" className="col-span-2 md:col-span-1">
                        <input aria-label={`SKU ${label}`} value={r.sku} placeholder={previewSku(sku, r)} onChange={(e) => setGrid((g) => setRow(g, r.key, { sku: e.target.value.toUpperCase() }))} className="input" aria-invalid={!!ek("sku")} />
                        <Err id={`e-${r.key}-sku`} text={ek("sku")} />
                      </div>
                      <div role="cell">
                        <input aria-label={`Estoque ${label}`} inputMode="numeric" placeholder="0" value={r.stock} readOnly={lockStock} title={lockStock ? "Sem permissão para alterar estoque" : undefined}
                          onChange={(e) => setGrid((g) => setRow(g, r.key, { stock: e.target.value }))} className="input" aria-invalid={!!ek("stock")} />
                        <Err id={`e-${r.key}-stock`} text={ek("stock")} />
                      </div>
                      <label role="cell" className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" aria-label={`${r.id ? "Ativa" : "Criar"} ${label}`} checked={r.active} onChange={(e) => setGrid((g) => setRow(g, r.key, { active: e.target.checked }))} className="h-5 w-5" />{r.id ? "Ativa" : "Criar"}
                      </label>
                      {ek("size") && <div className="col-span-2 md:col-span-5"><Err id={`e-${r.key}-size`} text={ek("size")} /></div>}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs text-mute">Variações já cadastradas nunca são apagadas: ao desmarcar, ficam inativas e mantêm o histórico e o estoque. {canEditStock ? "Alterar uma quantidade registra um ajuste no histórico de estoque." : "Seu perfil não altera estoque de variações já cadastradas."}</p>
          </>
        )}
      </Section>

      <Section n={8} title="Revisão e publicação">
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="f-status">Situação na loja</label>
            <select id="f-status" name="status" form={FORM} value={status} onChange={(e) => { setStatus(e.target.value); setDirty(true); }} className="input">
              {["PUBLISHED", "DRAFT", "UNAVAILABLE", ...(product?.status === "ARCHIVED" ? ["ARCHIVED"] : [])].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
            <Err id="e-status" text={errors.status} /></div>
          <ul className="text-sm text-mute">
            <li>Tipo: {KIND_LABEL[kind]}</li><li>Tamanhos: {grid.sizes.length ? grid.sizes.join(", ") : "—"}</li>
            <li>Cores: {grid.colors.length ? grid.colors.join(", ") : "—"}</li><li>Variações ativas: {c.active} · estoque total {c.stock}</li>
          </ul>
        </div>
        {progress && <p role="status" className="flash">{progress}</p>}
      </Section>

      <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-ink/95 p-3 backdrop-blur">
        <button type="submit" form={FORM} className="btn flex-1 sm:flex-none sm:min-w-56" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : isNew ? "Cadastrar produto" : "Salvar alterações"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { if (!dirty || confirm("Descartar as alterações não salvas?")) router.push("/admin/produtos"); }}>Cancelar</button>
        {dirty && <span className="text-xs text-accent" role="status">Alterações não salvas</span>}
      </div>
    </div>
  );
}
