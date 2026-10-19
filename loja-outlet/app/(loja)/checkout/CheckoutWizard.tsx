"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { placeOrder, quoteCheckoutShipping } from "@/app/actions/checkout";
import { brl } from "@/lib/money";
import { installmentOptions, METHOD_LABEL, type InstallmentRule, type Method } from "@/lib/payments/types";
import type { CheckoutMethod } from "@/lib/payments/config";

type Data = Record<"name" | "email" | "phone" | "zip" | "street" | "number" | "complement" | "district" | "city" | "state", string>;
type Line = { id: string; name: string; color: string; size: string; quantity: number; totalCents: number; imageUrl: string | null };
type Ship = { label: string; days: number; priceCents: number };

const STEPS = ["Identificação", "Entrega", "Pagamento", "Revisão"] as const;
const DRAFT = "checkout-draft-v1"; // só dados de contato/entrega; nunca dados de cartão

export function CheckoutWizard(p: {
  idempotencyKey: string; loggedIn: boolean; lines: Line[]; subtotalCents: number; discountCents: number; couponCode: string | null;
  defaults: Data; methods: CheckoutMethod[]; rule: InstallmentRule; mode: "OFF" | "TEST" | "LIVE";
}) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Data>(p.defaults);
  const [ship, setShip] = useState<Ship | null>(null);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | "">("");
  const [inst, setInst] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, action, pending] = useActionState(placeOrder, undefined);

  // Mantém o que o cliente já digitou se ele recarregar a página ou voltar.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT);
      if (raw) { const s = JSON.parse(raw) as Partial<Data>; queueMicrotask(() => setD((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(s).filter(([k, v]) => v && !p.defaults[k as keyof Data])) }))); }
    } catch { /* sem sessionStorage */ }
  }, [p.defaults]);
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* ignora */ } }, [d]);

  const net = p.subtotalCents - p.discountCents;
  const total = net + (ship?.priceCents ?? 0);
  const options = useMemo(() => installmentOptions(total, p.rule), [total, p.rule]);
  const set = (k: keyof Data) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  async function quote() {
    setBusy(true); setShipMsg(null);
    const q = await quoteCheckoutShipping(d.zip);
    setBusy(false); setShip(q);
    if (!q) setShipMsg("CEP inválido. Confira e tente de novo.");
  }
  function next() {
    setErr(null);
    if (step === 1) {
      if (d.name.trim().length < 3) return setErr("Informe seu nome completo.");
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return setErr("Informe um e-mail válido.");
    }
    if (step === 2) {
      if (!ship) return setErr("Calcule o frete com o CEP para continuar.");
      for (const [k, l] of [["street", "a rua"], ["number", "o número"], ["district", "o bairro"], ["city", "a cidade"], ["state", "a UF"]] as const) if (!d[k].trim()) return setErr(`Informe ${l}.`);
      if (d.state.trim().length !== 2) return setErr("A UF deve ter 2 letras (ex.: SP).");
    }
    if (step === 3 && !method) return setErr("Escolha a forma de pagamento.");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
    if (step === 1 && !ship && d.zip.replace(/\D/g, "").length === 8) void quote();
  }
  const back = () => { setErr(null); setStep((s) => Math.max(1, s - 1)); };
  const f = (k: keyof Data, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={`f-${k}`}>{label}</label><input id={`f-${k}`} value={d[k]} onChange={set(k)} className="input" {...extra} /></div>
  );
  const btn = "inline-flex min-h-11 items-center";
  const chosen = p.methods.find((m) => m.method === method);

  return (
    <div className="container-x grid gap-8 py-6 lg:grid-cols-[1fr_380px]">
      <div>
        <nav aria-label="Etapas da compra" className="mb-5 text-xs text-mute">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li><Link href="/carrinho" className={`${btn} underline`}>Carrinho</Link></li>
            {STEPS.map((s, i) => (<li key={s} aria-current={step === i + 1 ? "step" : undefined} className={step === i + 1 ? "font-bold text-accent" : i + 1 < step ? "text-white" : ""}>› {i + 1}. {s}</li>))}
            <li>› Confirmação</li>
          </ol>
        </nav>
        {p.mode === "TEST" && <p className="flash mb-4"><strong>MODO DE TESTE.</strong> Nenhuma cobrança real será feita.</p>}
        {!p.loggedIn && step === 1 && <p className="flash mb-4">Tem conta? <Link className="underline" href="/conta/entrar">Entre</Link> para acompanhar seus pedidos. Você também pode comprar sem cadastro.</p>}

        <div className="card space-y-4 p-4">
          {step === 1 && (<>
            <h1 className="h-display text-2xl">Identificação</h1>
            <div className="grid gap-3 md:grid-cols-2">{f("name", "Nome completo", { autoComplete: "name" })}{f("email", "E-mail", { type: "email", autoComplete: "email" })}{f("phone", "Telefone (opcional)", { autoComplete: "tel", inputMode: "tel" })}</div>
          </>)}
          {step === 2 && (<>
            <h1 className="h-display text-2xl">Endereço de entrega</h1>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1"><label className="label" htmlFor="f-zip">CEP</label><input id="f-zip" value={d.zip} onChange={(e) => { set("zip")(e); setShip(null); }} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" className="input" /></div>
              <button type="button" className="btn btn-ghost" onClick={quote} disabled={busy}>{busy ? "Calculando..." : "Calcular frete"}</button>
            </div>
            {shipMsg && <p role="alert" className="flash flash-err">{shipMsg}</p>}
            {ship && <p className="flash">{ship.label} — {ship.priceCents ? brl(ship.priceCents) : "Grátis"} · {ship.days} dias úteis</p>}
            <div className="grid gap-3 md:grid-cols-2">{f("street", "Rua", { autoComplete: "address-line1" })}{f("number", "Número")}{f("complement", "Complemento")}{f("district", "Bairro")}{f("city", "Cidade", { autoComplete: "address-level2" })}{f("state", "UF", { maxLength: 2, autoComplete: "address-level1" })}</div>
          </>)}
          {step === 3 && (<>
            <h1 className="h-display text-2xl">Forma de pagamento</h1>
            {!p.methods.length && <p className="flash flash-err">Nenhuma forma de pagamento está ativa no momento. Fale com a loja.</p>}
            <div role="radiogroup" aria-label="Forma de pagamento" className="space-y-2">
              {p.methods.map((m) => (
                <label key={m.method} className={`flex min-h-11 cursor-pointer items-start gap-3 border p-3 ${method === m.method ? "border-accent" : "border-line"}`}>
                  <input type="radio" name="pm" className="mt-1 h-5 w-5" checked={method === m.method} onChange={() => { setMethod(m.method); setInst(1); }} />
                  <span><strong>{m.label}</strong>{m.note && <span className="ml-2 badge">{m.note}</span>}</span>
                </label>
              ))}
            </div>
            {method === "CREDIT_CARD" && (
              <div><label className="label" htmlFor="inst">Parcelas</label>
                <select id="inst" value={inst} onChange={(e) => setInst(Number(e.target.value))} className="input max-w-xs">
                  {options.map((o) => <option key={o.n} value={o.n}>{o.n}x de {brl(o.perCents)} {o.n > 1 ? "sem juros" : "à vista"}</option>)}
                </select></div>
            )}
            {p.mode === "OFF" && <p className="text-sm text-mute">O recebimento online ainda não está ativo. Seu pedido será registrado e a loja confirmará o pagamento.</p>}
            <p className="text-xs text-mute">Não guardamos dados de cartão. O cartão é tokenizado pelo gateway no momento do pagamento.</p>
          </>)}
          {step === 4 && (
            <form action={action} className="space-y-4">
              <h1 className="h-display text-2xl">Revisar e confirmar pedido</h1>
              <input type="hidden" name="idempotencyKey" value={p.idempotencyKey} />
              {(["name", "email", "phone", "zip", "street", "number", "complement", "district", "city", "state"] as const).map((k) => <input key={k} type="hidden" name={k} value={d[k]} />)}
              <input type="hidden" name="paymentMethod" value={method} />
              <input type="hidden" name="installments" value={method === "CREDIT_CARD" ? inst : 1} />
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="label">Cliente</dt><dd>{d.name}<br />{d.email}{d.phone && <><br />{d.phone}</>}</dd></div>
                <div><dt className="label">Entrega</dt><dd>{d.street}, {d.number} {d.complement}<br />{d.district} — {d.city}/{d.state.toUpperCase()}<br />CEP {d.zip}{ship && <><br />{ship.label} · {ship.days} dias úteis</>}</dd></div>
                <div><dt className="label">Pagamento</dt><dd>{method && METHOD_LABEL[method]}{method === "CREDIT_CARD" && ` em ${inst}x de ${brl(Math.ceil(total / inst))}`}{chosen?.note && <><br /><span className="text-mute">{chosen.note}</span></>}</dd></div>
              </dl>
              {state?.error && <p role="alert" className="flash flash-err">{state.error}</p>}
              <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost" onClick={back}>Voltar</button><button className="btn flex-1" disabled={pending}>{pending ? "Confirmando..." : "Confirmar pedido"}</button></div>
            </form>
          )}
          {err && <p role="alert" className="flash flash-err">{err}</p>}
          {step < 4 && (<div className="flex flex-wrap gap-2">
            {step > 1 && <button type="button" className="btn btn-ghost" onClick={back}>Voltar</button>}
            <button type="button" className="btn flex-1 md:flex-none md:min-w-48" onClick={next}>Continuar</button></div>)}
        </div>
      </div>

      <aside className="card h-fit space-y-3 p-4 text-sm" aria-label="Resumo do pedido">
        <h2 className="h-display text-xl">Resumo do pedido</h2>
        {p.lines.map((l) => (<div key={l.id} className="flex justify-between gap-2"><span>{l.quantity}× {l.name} ({l.color}/{l.size})</span><span>{brl(l.totalCents)}</span></div>))}
        <div className="flex justify-between border-t border-line pt-2"><span>Subtotal</span><span>{brl(p.subtotalCents)}</span></div>
        {p.discountCents > 0 && <div className="flex justify-between text-accent"><span>Cupom {p.couponCode}</span><span>-{brl(p.discountCents)}</span></div>}
        <div className="flex justify-between"><span>Frete {ship ? `(${ship.days} dias úteis)` : ""}</span><span>{ship ? (ship.priceCents ? brl(ship.priceCents) : "Grátis") : "calcule no passo 2"}</span></div>
        <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><span>Total</span><span>{brl(total)}</span></div>
        <Link href="/carrinho" className={`${btn} text-xs underline`}>← Voltar ao carrinho</Link>
      </aside>
    </div>
  );
}
