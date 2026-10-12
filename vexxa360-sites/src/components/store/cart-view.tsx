"use client";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { useCart } from "./cart";
import { placeOrder, priceCart, type PricedLine } from "@/lib/actions/checkout";
import { formatBRL, fromCents, toCents } from "@/lib/money";
import { Alert, btnClass } from "../ui";

type Done = { orderNumber: number; total: number; whatsappUrl: string | null; message: string };

export function CartView({ slug, hasWhatsapp }: { slug: string; hasWhatsapp: boolean }) {
  const cart = useCart();
  const [lines, setLines] = useState<PricedLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const ids = cart.items.map((i) => i.variantId).join(",");
  useEffect(() => {
    if (!cart.ready) return;
    if (!ids) { setLines([]); return; }
    let live = true;
    priceCart(slug, ids.split(",")).then((l) => live && setLines(l)).catch(() => live && setError("Não foi possível atualizar os preços. Tente recarregar."));
    return () => { live = false; };
  }, [slug, ids, cart.ready]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
        <MessageCircle className="mx-auto size-10 text-accent" aria-hidden />
        <h1 className="mt-3 font-serif text-2xl">Pedido #{done.orderNumber} registrado</h1>
        <p className="mt-2 text-sm text-muted">{done.message}</p>
        <p className="mt-1 text-sm text-muted">Total: <strong className="text-ink">{formatBRL(done.total)}</strong> · O pedido só é confirmado quando a loja responder.</p>
        {done.whatsappUrl && (
          <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${btnClass.primary} mt-6 w-full`}>
            <MessageCircle className="size-4" /> Abrir WhatsApp e enviar o pedido
          </a>
        )}
        <Link href={`/loja/${slug}/produtos`} className={`${btnClass.ghost} mt-2 w-full`}>Continuar comprando</Link>
      </div>
    );
  }

  if (!cart.ready || lines === null) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="size-6 animate-spin" aria-label="Carregando sacola" /></div>;

  if (cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
        <p className="font-serif text-xl">Sua sacola está vazia</p>
        <p className="mt-1 text-sm text-muted">Escolha suas peças favoritas para começar.</p>
        <Link href={`/loja/${slug}/produtos`} className={`${btnClass.primary} mt-5`}>Ver produtos</Link>
      </div>
    );
  }

  const byId = new Map(lines.map((l) => [l.variantId, l]));
  const rows = cart.items.map((it) => ({ it, l: byId.get(it.variantId) }));
  const problems = rows.filter(({ it, l }) => !l || !l.available || it.quantity > l.stock);
  const subtotal = rows.reduce((s, { it, l }) => s + (l?.available ? toCents(l.regularPrice) * it.quantity : 0), 0);
  const total = rows.reduce((s, { it, l }) => s + (l?.available ? toCents(l.unitPrice) * it.quantity : 0), 0);
  const canCheckout = problems.length === 0 && hasWhatsapp;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    start(async () => {
      const res = await placeOrder({
        slug, name: form.name, phone: form.phone, email: form.email, notes: form.notes,
        items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      if (!res.ok) { setError(res.error ?? "Erro ao registrar o pedido."); setFieldErrors(res.fieldErrors ?? {}); return; }
      const d = res.data as { orderNumber: number; total: number; whatsappUrl: string | null };
      cart.clear();
      setDone({ ...d, message: res.message ?? "" });
      if (d.whatsappUrl) window.open(d.whatsappUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="itens">
        <h1 id="itens" className="mb-5 font-serif text-3xl">Sua sacola</h1>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map(({ it, l }) => {
            const bad = !l || !l.available || it.quantity > (l?.stock ?? 0);
            const img = l?.image ?? it.image;
            return (
              <li key={it.variantId} className="flex gap-4 p-4">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-soft">{img && <Image src={img} alt="" fill sizes="96px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l?.name ?? it.name}</p>
                  <p className="text-sm text-muted">{[it.size && `Tam. ${it.size}`, it.color].filter(Boolean).join(" · ")}</p>
                  {l?.available ? <p className="mt-1 text-sm">{l.unitPrice < l.regularPrice && <span className="mr-2 text-muted line-through">{formatBRL(l.regularPrice)}</span>}{formatBRL(l.unitPrice)}</p> : null}
                  {bad && <p className="mt-1 text-sm text-danger">{!l || !l.available ? "Item indisponível — remova para continuar." : `Só há ${l.stock} em estoque.`}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-full border border-line">
                      <button className="size-8 rounded-full hover:bg-soft" aria-label="Diminuir" onClick={() => cart.setQuantity(it.variantId, it.quantity - 1)}>−</button>
                      <span className="w-7 text-center text-sm">{it.quantity}</span>
                      <button className="size-8 rounded-full hover:bg-soft disabled:opacity-40" aria-label="Aumentar" disabled={!!l && it.quantity >= l.stock} onClick={() => cart.setQuantity(it.variantId, it.quantity + 1)}>+</button>
                    </div>
                    <button className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger" onClick={() => cart.remove(it.variantId)}><Trash2 className="size-4" /> Remover</button>
                  </div>
                </div>
                <p className="text-sm font-medium">{l?.available ? formatBRL(fromCents(toCents(l.unitPrice) * it.quantity)) : "—"}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="h-fit rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24">
        <h2 className="font-serif text-xl">Resumo</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatBRL(fromCents(subtotal))}</dd></div>
          {subtotal > total && <div className="flex justify-between text-accent"><dt>Descontos</dt><dd>-{formatBRL(fromCents(subtotal - total))}</dd></div>}
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatBRL(fromCents(total))}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted">Frete e forma de pagamento são combinados com a loja pelo WhatsApp. Valores finais são conferidos pelo sistema ao enviar o pedido.</p>

        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <div>
            <label className="label" htmlFor="c-name">Seu nome</label>
            <input id="c-name" className="field" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {fieldErrors.name && <p className="mt-1 text-xs text-danger">{fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label className="label" htmlFor="c-phone">WhatsApp / telefone</label>
            <input id="c-phone" className="field" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {fieldErrors.phone && <p className="mt-1 text-xs text-danger">{fieldErrors.phone[0]}</p>}
          </div>
          <div>
            <label className="label" htmlFor="c-email">E-mail (opcional)</label>
            <input id="c-email" className="field" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {fieldErrors.email && <p className="mt-1 text-xs text-danger">{fieldErrors.email[0]}</p>}
          </div>
          <div>
            <label className="label" htmlFor="c-notes">Observações (opcional)</label>
            <textarea id="c-notes" className="field" rows={2} maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          {!hasWhatsapp && <Alert kind="info">Esta loja ainda não configurou o WhatsApp de atendimento.</Alert>}
          {problems.length > 0 && <Alert kind="error">Ajuste os itens indisponíveis para continuar.</Alert>}
          <button type="submit" disabled={pending || !canCheckout}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-on-brand transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            {pending ? "Registrando pedido…" : "Finalizar pelo WhatsApp"}
          </button>
        </form>
      </aside>
    </div>
  );
}
