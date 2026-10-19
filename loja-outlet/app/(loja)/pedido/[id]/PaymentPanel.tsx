"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payWithTestCard, retryPayment, simulateAsCustomer, type ActionResult } from "@/app/actions/payment";
import { brl } from "@/lib/money";
import { installmentOptions, METHOD_LABEL, type InstallmentRule } from "@/lib/payments/types";
import { TEST_CARDS, tokenizeTestCard } from "@/lib/payments/test-card";

type P = { id: string; method: string | null; status: string; isTest: boolean; provider: string; installments: number; pixCopyPaste: string | null; expiresAt: string | null };

function useResult() {
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r); router.refresh(); });
  return { msg, pending, run };
}

function Countdown({ iso }: { iso: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { const t = () => setLeft(Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000))); t(); const i = setInterval(t, 1000); return () => clearInterval(i); }, [iso]);
  if (left === null) return null;
  const m = String(Math.floor(left / 60)).padStart(2, "0"), s = String(left % 60).padStart(2, "0");
  return <p className="text-sm">Expira em <strong>{left === 0 ? "00:00 (expirado)" : `${m}:${s}`}</strong></p>;
}

function PixBox({ p }: { p: P }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="grid h-40 w-40 place-items-center border-2 border-dashed border-accent text-center text-xs font-bold text-accent" aria-label="QR Code de teste (não pagável)">QR CODE<br />DE TESTE<br />(não pagável)</div>
      <label className="label" htmlFor="pix-code">PIX copia e cola {p.isTest && "(TESTE)"}</label>
      <div className="flex gap-2"><input id="pix-code" readOnly value={p.pixCopyPaste ?? ""} className="input" />
        <button type="button" className="btn btn-ghost shrink-0" onClick={async () => { try { await navigator.clipboard.writeText(p.pixCopyPaste ?? ""); setCopied(true); } catch { /* sem permissão */ } }}>{copied ? "Copiado" : "Copiar"}</button></div>
      {p.expiresAt && <Countdown iso={p.expiresAt} />}
    </div>
  );
}

function CardTest({ orderId, p, totalCents, rule }: { orderId: string; p: P; totalCents: number; rule: InstallmentRule }) {
  const { msg, pending, run } = useResult();
  const [num, setNum] = useState(""); const [name, setName] = useState(""); const [exp, setExp] = useState(""); const [cvv, setCvv] = useState("");
  const [inst, setInst] = useState(p.installments); const [err, setErr] = useState<string | null>(null);
  const opts = p.method === "CREDIT_CARD" ? installmentOptions(totalCents, rule) : [];
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (name.trim().length < 3 || !/^\d{2}\/\d{2}$/.test(exp) || !/^\d{3,4}$/.test(cvv)) return setErr("Preencha nome, validade (MM/AA) e CVV.");
    const t = tokenizeTestCard(num);
    if ("error" in t) return setErr(t.error);
    // limpa os campos sensíveis ANTES de falar com o servidor; só o token sai do navegador
    setNum(""); setCvv(""); setExp("");
    run(() => payWithTestCard(orderId, t.token, t.brand, t.last4, p.method === "CREDIT_CARD" ? inst : 1));
  }
  return (
    <form onSubmit={submit} className="space-y-3" autoComplete="off">
      <p className="text-xs text-mute">Cartões de teste: {TEST_CARDS.map((c) => <button type="button" key={c.number} className="mr-2 inline-flex min-h-11 items-center underline" onClick={() => setNum(c.number)}>{c.number} ({c.label})</button>)}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><label className="label" htmlFor="cc-num">Número do cartão</label><input id="cc-num" value={num} onChange={(e) => setNum(e.target.value.replace(/[^\d ]/g, "").slice(0, 23))} inputMode="numeric" autoComplete="off" className="input" /></div>
        <div><label className="label" htmlFor="cc-name">Nome impresso</label><input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="input" /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="cc-exp">Validade</label><input id="cc-exp" value={exp} onChange={(e) => setExp(e.target.value.replace(/[^\d/]/g, "").slice(0, 5))} placeholder="MM/AA" autoComplete="off" className="input" /></div>
          <div><label className="label" htmlFor="cc-cvv">CVV</label><input id="cc-cvv" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" className="input" /></div></div>
        {opts.length > 0 && <div><label className="label" htmlFor="cc-inst">Parcelas</label><select id="cc-inst" value={inst} onChange={(e) => setInst(Number(e.target.value))} className="input">{opts.map((o) => <option key={o.n} value={o.n}>{o.n}x de {brl(o.perCents)}</option>)}</select></div>}
      </div>
      {(err || (msg && !msg.ok)) && <p role="alert" className="flash flash-err">{err ?? msg?.message}</p>}
      <button className="btn w-full md:w-auto" disabled={pending}>{pending ? "Processando..." : `Pagar ${brl(totalCents)} (TESTE)`}</button>
      <p className="text-xs text-mute">Número, validade e CVV não saem do seu navegador nem são armazenados: o servidor recebe apenas um token, a bandeira e os 4 últimos dígitos.</p>
    </form>
  );
}

export function TestPanel({ orderId }: { orderId: string }) {
  const { msg, pending, run } = useResult();
  const items: [string, "approved" | "rejected" | "pending" | "expired" | "cancelled" | "refunded"][] = [["Aprovar", "approved"], ["Recusar", "rejected"], ["Deixar pendente", "pending"], ["Expirar", "expired"], ["Cancelar", "cancelled"], ["Estornar", "refunded"]];
  return (
    <section aria-label="Simulação de teste" className="border-2 border-dashed border-accent p-3">
      <p className="label !text-accent">TESTE — painel de simulação (nenhuma cobrança real)</p>
      <div className="flex flex-wrap gap-2">{items.map(([l, s]) => <button key={s} type="button" disabled={pending} className="btn btn-ghost" onClick={() => run(() => simulateAsCustomer(orderId, s))}>{l}</button>)}</div>
      {msg && <p role="status" className={`mt-2 ${msg.ok ? "flash" : "flash flash-err"}`}>{msg.message}</p>}
    </section>
  );
}

export function RetryForm({ orderId, methods, rule, totalCents }: { orderId: string; methods: { method: string; label: string }[]; rule: InstallmentRule; totalCents: number }) {
  const { msg, pending, run } = useResult();
  const [m, setM] = useState(methods[0]?.method ?? ""); const [inst, setInst] = useState(1);
  return (
    <div className="space-y-3">
      <label className="label" htmlFor="retry-m">Escolha como pagar</label>
      <select id="retry-m" value={m} onChange={(e) => { setM(e.target.value); setInst(1); }} className="input max-w-xs">{methods.map((x) => <option key={x.method} value={x.method}>{x.label}</option>)}</select>
      {m === "CREDIT_CARD" && <select aria-label="Parcelas" value={inst} onChange={(e) => setInst(Number(e.target.value))} className="input max-w-xs">{installmentOptions(totalCents, rule).map((o) => <option key={o.n} value={o.n}>{o.n}x de {brl(o.perCents)}</option>)}</select>}
      {msg && !msg.ok && <p role="alert" className="flash flash-err">{msg.message}</p>}
      <button type="button" className="btn" disabled={pending || !m} onClick={() => run(() => retryPayment(orderId, m, inst))}>Tentar novamente</button>
    </div>
  );
}

export function PaymentPanel(props: { orderId: string; payment: P; totalCents: number; rule: InstallmentRule; testMode: boolean }) {
  const { payment: p } = props;
  const active = p.status === "PENDING" || p.status === "PROCESSING";
  return (
    <div className="space-y-4">
      {p.isTest && <p className="flash"><strong>AMBIENTE DE TESTE.</strong> Esta é uma simulação — nenhuma cobrança real foi ou será feita.</p>}
      {active && p.isTest && p.method === "PIX" && <PixBox p={p} />}
      {active && p.isTest && (p.method === "CREDIT_CARD" || p.method === "DEBIT_CARD") && p.status === "PENDING" && <CardTest orderId={props.orderId} p={p} totalCents={props.totalCents} rule={props.rule} />}
      {active && p.isTest && p.status === "PROCESSING" && <p className="flash">Pagamento em análise. Atualizaremos o pedido assim que for concluído.</p>}
      {active && p.isTest && props.testMode && <TestPanel orderId={props.orderId} />}
      {!p.isTest && active && <p className="text-sm text-mute">Forma escolhida: {METHOD_LABEL[p.method ?? "OTHER"]}.</p>}
    </div>
  );
}
