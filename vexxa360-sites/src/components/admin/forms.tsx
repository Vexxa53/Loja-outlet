"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveBanner, saveCategory, savePromotion } from "@/lib/actions/catalog";
import { saveBranding, saveSettings } from "@/lib/actions/settings";
import { createTenant } from "@/lib/actions/master";
import { initialState, type ActionState } from "@/lib/validation/common";
import { Alert, Card, Field } from "../ui";
import { SubmitButton } from "../submit-button";
import { ImageField } from "./image-field";

function Result({ state }: { state: ActionState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.ok) return <Alert kind="ok">{state.message}</Alert>;
  return null;
}

/** Limpa o formulário depois de criar (não em edição). */
function useResetOnSuccess(state: ActionState, enabled: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && enabled) ref.current?.reset(); }, [state, enabled]);
  return ref;
}

export function CategoryForm({ category, imageUrl }: { category?: { id: string; name: string; description: string | null; active: boolean; sort_order: number }; imageUrl?: string | null }) {
  const [state, action] = useActionState(saveCategory, initialState);
  const ref = useResetOnSuccess(state, !category);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {category && <input type="hidden" name="id" value={category.id} />}
      <Field label="Nome" name="name" error={fe.name}><input id="name" name="name" defaultValue={category?.name} required maxLength={80} className="field" placeholder="Ex.: Vestidos" /></Field>
      <Field label="Ordem de exibição" name="sortOrder" error={fe.sortOrder}><input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={category?.sort_order ?? 0} className="field" /></Field>
      <div className="sm:col-span-2"><Field label="Descrição (opcional)" name="description" error={fe.description}><input id="description" name="description" defaultValue={category?.description ?? ""} maxLength={500} className="field" /></Field></div>
      <div className="sm:col-span-2"><ImageField name="image" label="Imagem da categoria (opcional)" current={imageUrl} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Visível na loja</label>
      <div className="sm:col-span-2 space-y-3"><Result state={state} /><SubmitButton pendingText="Salvando…">{category ? "Salvar alterações" : "Criar categoria"}</SubmitButton></div>
    </form>
  );
}

export function PromotionForm({ products }: { products: { id: string; name: string; price: string }[] }) {
  const [state, action] = useActionState(savePromotion, initialState);
  const ref = useResetOnSuccess(state, true);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Field label="Nome da campanha" name="name" error={fe.name}><input id="name" name="name" required maxLength={120} className="field" placeholder="Ex.: Liquida de Verão" /></Field></div>
      <Field label="Produto" name="productId" error={fe.productId} hint="Deixe em “Toda a loja” para aplicar a todos os produtos.">
        <select id="productId" name="productId" className="field" defaultValue=""><option value="">Toda a loja</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price})</option>)}</select>
      </Field>
      <Field label="Tipo de desconto" name="discountType" error={fe.discountType}>
        <select id="discountType" name="discountType" className="field" defaultValue="percent">
          <option value="percent">Percentual (%)</option><option value="amount_off">Valor em R$ de desconto</option><option value="fixed_price">Preço final fixo (R$) — exige produto</option>
        </select>
      </Field>
      <Field label="Valor" name="discountValue" error={fe.discountValue} hint="Ex.: 20 (para 20%) ou 99,90."><input id="discountValue" name="discountValue" inputMode="decimal" required className="field" /></Field>
      <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
        <Field label="Início (horário de Brasília)" name="startsAt" error={fe.startsAt}><input id="startsAt" name="startsAt" type="datetime-local" required className="field" /></Field>
        <Field label="Encerramento (horário de Brasília)" name="endsAt" error={fe.endsAt}><input id="endsAt" name="endsAt" type="datetime-local" required className="field" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Campanha ativa (entra e sai do ar sozinha nas datas)</label>
      <div className="sm:col-span-2 space-y-3"><Result state={state} /><SubmitButton pendingText="Criando…">Criar campanha</SubmitButton></div>
    </form>
  );
}

export function BannerForm({ banner, imageUrl }: { banner?: { id: string; title: string; subtitle: string | null; button_label: string | null; destination_url: string | null; active: boolean; sort_order: number }; imageUrl?: string | null }) {
  const [state, action] = useActionState(saveBanner, initialState);
  const ref = useResetOnSuccess(state, !banner);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <div className="sm:col-span-2"><ImageField name="image" label="Imagem do banner" current={imageUrl} required={!banner} /></div>
      <Field label="Título" name="title" error={fe.title}><input id="title" name="title" defaultValue={banner?.title} required maxLength={120} className="field" /></Field>
      <Field label="Subtítulo" name="subtitle" error={fe.subtitle}><input id="subtitle" name="subtitle" defaultValue={banner?.subtitle ?? ""} maxLength={240} className="field" /></Field>
      <Field label="Texto do botão" name="buttonLabel" error={fe.buttonLabel}><input id="buttonLabel" name="buttonLabel" defaultValue={banner?.button_label ?? ""} maxLength={40} className="field" placeholder="Ver coleção" /></Field>
      <Field label="Destino do botão" name="destinationUrl" error={fe.destinationUrl} hint="Ex.: /loja/sua-loja/produtos?promocao=1 ou https://…"><input id="destinationUrl" name="destinationUrl" defaultValue={banner?.destination_url ?? ""} className="field" /></Field>
      <Field label="Ordem" name="sortOrder" error={fe.sortOrder}><input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={banner?.sort_order ?? 0} className="field" /></Field>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="active" defaultChecked={banner?.active ?? true} /> Exibir na loja</label>
      <div className="sm:col-span-2 space-y-3"><Result state={state} /><SubmitButton pendingText="Salvando…">{banner ? "Salvar banner" : "Criar banner"}</SubmitButton></div>
    </form>
  );
}

type S = Record<string, any>;
export function BrandingForm({ s, logoUrl }: { s: S; logoUrl: string | null }) {
  const [state, action] = useActionState(saveBranding, initialState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Identidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nome comercial" name="storeName" error={fe.storeName}><input id="storeName" name="storeName" defaultValue={s.store_name} required maxLength={120} className="field" /></Field></div>
          <div className="sm:col-span-2"><Field label="Texto de apresentação" name="description" error={fe.description}><textarea id="description" name="description" defaultValue={s.description ?? ""} rows={3} maxLength={1000} className="field" placeholder="Conte em poucas linhas o estilo da sua loja." /></Field></div>
          <div className="sm:col-span-2"><ImageField name="logo" label="Logotipo" current={logoUrl} />
            {logoUrl && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" /> Remover logotipo atual</label>}</div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Cores</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cor principal (botões)" name="primaryColor" error={fe.primaryColor}><input id="primaryColor" name="primaryColor" type="color" defaultValue={s.primary_color} className="h-11 w-full cursor-pointer rounded-lg border border-line bg-white p-1" /></Field>
          <Field label="Cor de destaque (ofertas, detalhes)" name="secondaryColor" error={fe.secondaryColor}><input id="secondaryColor" name="secondaryColor" type="color" defaultValue={s.secondary_color} className="h-11 w-full cursor-pointer rounded-lg border border-line bg-white p-1" /></Field>
        </div>
        <p className="mt-3 text-xs text-muted">O texto dos botões ajusta para branco ou preto automaticamente, garantindo leitura.</p>
      </Card>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Redes</h2>
        <Field label="Instagram" name="instagram" error={fe.instagram} hint="Somente o usuário, sem @ (ou cole o link do perfil)."><input id="instagram" name="instagram" defaultValue={s.instagram ?? ""} className="field" placeholder="minhaloja" /></Field>
      </Card>
      <div className="space-y-3"><Result state={state} /><SubmitButton pendingText="Salvando…">Salvar personalização</SubmitButton></div>
    </form>
  );
}

export function SettingsForm({ s }: { s: S }) {
  const [state, action] = useActionState(saveSettings, initialState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Atendimento e pedidos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp da loja" name="whatsapp" error={fe.whatsapp} hint="Com DDD. Os pedidos chegam neste número."><input id="whatsapp" name="whatsapp" defaultValue={s.whatsapp ?? ""} inputMode="tel" required className="field" placeholder="(11) 99999-9999" /></Field>
          <Field label="E-mail de contato" name="contactEmail" error={fe.contactEmail}><input id="contactEmail" name="contactEmail" type="email" defaultValue={s.contact_email ?? ""} className="field" /></Field>
          <div className="sm:col-span-2"><Field label="Horário de atendimento" name="businessHours" error={fe.businessHours}><input id="businessHours" name="businessHours" defaultValue={s.business_hours ?? ""} maxLength={300} className="field" placeholder="Seg a sáb, 9h às 18h" /></Field></div>
          <div className="sm:col-span-2"><Field label="Endereço comercial (opcional)" name="address" error={fe.address}><input id="address" name="address" defaultValue={s.address ?? ""} maxLength={300} className="field" /></Field></div>
          <div className="sm:col-span-2"><Field label="Informações de entrega" name="shippingInfo" error={fe.shippingInfo}><textarea id="shippingInfo" name="shippingInfo" defaultValue={s.shipping_info ?? ""} rows={3} maxLength={1000} className="field" placeholder="Prazos, regiões atendidas, retirada na loja…" /></Field></div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Políticas e medidas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Privacidade (link https)" name="privacyUrl" error={fe.privacyUrl}><input id="privacyUrl" name="privacyUrl" defaultValue={s.privacy_url ?? ""} className="field" /></Field>
          <Field label="Termos (link https)" name="termsUrl" error={fe.termsUrl}><input id="termsUrl" name="termsUrl" defaultValue={s.terms_url ?? ""} className="field" /></Field>
          <Field label="Trocas (link https)" name="exchangeUrl" error={fe.exchangeUrl}><input id="exchangeUrl" name="exchangeUrl" defaultValue={s.exchange_url ?? ""} className="field" /></Field>
          <div className="sm:col-span-3"><Field label="Guia de medidas padrão" name="sizeGuide" error={fe.sizeGuide} hint="Aparece nos produtos que não têm guia próprio."><textarea id="sizeGuide" name="sizeGuide" defaultValue={s.size_guide ?? ""} rows={4} maxLength={4000} className="field" /></Field></div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-serif text-xl">Estoque e reservas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alerta de estoque baixo (unidades)" name="lowStockThreshold" error={fe.lowStockThreshold}><input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} defaultValue={s.low_stock_threshold ?? 3} className="field" /></Field>
          <Field label="Prazo de reserva (horas)" name="reservationHours" error={fe.reservationHours} hint="Pedidos ‘Novos’ sem resposta além deste prazo podem ter o estoque devolvido (botão em Pedidos)."><input id="reservationHours" name="reservationHours" type="number" min={1} max={720} defaultValue={s.reservation_hours ?? 48} className="field" /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-serif text-xl">SEO</h2>
        <div className="grid gap-4">
          <Field label="Título para buscadores" name="seoTitle" error={fe.seoTitle} hint="Até 70 caracteres."><input id="seoTitle" name="seoTitle" defaultValue={s.seo_title ?? ""} maxLength={70} className="field" /></Field>
          <Field label="Descrição para buscadores" name="seoDescription" error={fe.seoDescription} hint="Até 200 caracteres."><textarea id="seoDescription" name="seoDescription" defaultValue={s.seo_description ?? ""} rows={2} maxLength={200} className="field" /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-serif text-xl">Publicação</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={s.published} className="mt-0.5" /> <span><strong>Loja publicada</strong> — visível para qualquer pessoa. Desmarque para ocultar a vitrine (você continua vendo a pré-visualização).</span></label>
      </Card>
      <div className="space-y-3"><Result state={state} /><SubmitButton pendingText="Salvando…">Salvar configurações</SubmitButton></div>
    </form>
  );
}

export function TenantForm() {
  const [state, action] = useActionState(createTenant, initialState);
  const ref = useResetOnSuccess(state, true);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <Field label="Nome da loja" name="name" error={fe.name}><input id="name" name="name" required className="field" /></Field>
      <Field label="Identificador (URL)" name="slug" error={fe.slug} hint="/loja/identificador — letras minúsculas, números e hífens."><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field" /></Field>
      <Field label="E-mail do lojista" name="ownerEmail" error={fe.ownerEmail} hint="Se não tiver conta, enviamos um convite."><input id="ownerEmail" name="ownerEmail" type="email" required className="field" /></Field>
      <div className="space-y-3 sm:col-span-3"><Result state={state} /><SubmitButton pendingText="Criando…">Criar loja</SubmitButton></div>
    </form>
  );
}
