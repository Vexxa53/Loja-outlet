import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { getPaymentConfig, integrationState, secretsPresent } from "@/lib/payments/config";
import { GATEWAYS } from "@/lib/payments/types";
import { savePaymentSettings } from "@/app/actions/admin-payments";

const m = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin("settings.write");
  const sp = await searchParams;
  const cfg = await getPaymentConfig();
  const state = await integrationState(cfg);
  const has = await secretsPresent();
  const base = process.env.BASE_URL ?? "https://SEU-DOMINIO";
  const webhook = cfg.card.gateway === "mercadopago" ? `${base}/api/webhooks/mercadopago` : `${base}/api/webhooks/payments/${cfg.card.gateway}`;
  const f = (name: string, label: string, def: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (<div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={def} className="input" {...extra} /></div>);
  const secret = (name: "pixKey" | "secretKey" | "webhookSecret", label: string) => (
    <div><label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="password" autoComplete="new-password" placeholder={has[name] ? "•••••• configurada — deixe em branco para manter" : "Vazio (não configurado)"} className="input" />
      {has[name] && <label className="mt-1 flex min-h-11 items-center gap-2 text-xs text-mute"><input type="checkbox" name={`${name}_remove`} className="h-5 w-5" /> Remover este valor</label>}</div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="h-display text-2xl">Configurações → Pagamentos</h1><Link href="/admin/config" className="btn btn-ghost">← Configurações da loja</Link></div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="label !mb-0">Status da integração:</span>
        <span className={`badge ${state.mode === "OFF" ? "" : "badge-accent"}`}>{state.label}</span>
        {state.reason && <span className="text-sm text-mute">{state.reason}</span>}
      </div>
      <form action={savePaymentSettings} className="card space-y-6 p-4">
        <section className="space-y-2"><h2 className="font-bold uppercase">Modo</h2>
          <label className="label" htmlFor="mode">Como a loja recebe</label>
          <select id="mode" name="mode" defaultValue={cfg.mode} className="input max-w-md">
            <option value="OFF">Não configurado (pedido fica aguardando confirmação manual)</option>
            <option value="TEST">Teste / simulação (nenhuma cobrança real)</option>
            <option value="LIVE">Recebimento real (exige gateway e credenciais)</option>
          </select>
          <p className="text-xs text-mute">No modo Teste, as telas de PIX e cartão funcionam com dados simulados e um painel para aprovar, recusar, expirar, cancelar e estornar. Deixe em &quot;Não configurado&quot; ou &quot;Recebimento real&quot; na loja aberta ao público.</p>
        </section>

        <section className="space-y-3"><h2 className="font-bold uppercase">PIX</h2>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="pixEnabled" defaultChecked={cfg.pix.enabled} className="h-5 w-5" /> Ativar PIX no checkout</label>
          <div className="grid gap-3 md:grid-cols-3">{secret("pixKey", "Chave PIX do recebedor")}{f("receiverName", "Nome do recebedor", cfg.pix.receiverName)}{f("receiverCity", "Cidade do recebedor", cfg.pix.receiverCity)}{f("pixExpires", "Validade da cobrança (minutos)", String(cfg.pix.expiresMinutes), { inputMode: "numeric" })}</div>
          <p className="text-xs text-mute">A chave é guardada criptografada e nunca é exibida de novo. Neste momento deixe vazio.</p>
        </section>

        <section className="space-y-3"><h2 className="font-bold uppercase">Cartão</h2>
          <div className="flex flex-wrap gap-4"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="creditEnabled" defaultChecked={cfg.card.creditEnabled} className="h-5 w-5" /> Cartão de crédito</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="debitEnabled" defaultChecked={cfg.card.debitEnabled} className="h-5 w-5" /> Cartão de débito</label></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className="label" htmlFor="gateway">Gateway</label><select id="gateway" name="gateway" defaultValue={cfg.card.gateway} className="input">{GATEWAYS.map((g) => <option key={g.id} value={g.id}>{g.label}{g.installed ? "" : " (adaptador ainda não instalado)"}</option>)}</select></div>
            <div><label className="label" htmlFor="environment">Ambiente do gateway</label><select id="environment" name="environment" defaultValue={cfg.card.environment} className="input"><option value="TEST">Teste</option><option value="PRODUCTION">Produção</option></select></div>
            {f("publicKey", "Public Key (chave pública)", cfg.card.publicKey, { autoComplete: "off" })}
            {secret("secretKey", "Secret Key (chave secreta / Access Token)")}
            {f("maxInstallments", "Máximo de parcelas", String(cfg.card.maxInstallments), { inputMode: "numeric" })}
            {f("minInstallment", "Parcela mínima (R$)", m(cfg.card.minInstallmentCents))}
          </div>
        </section>

        <section className="space-y-3"><h2 className="font-bold uppercase">Webhooks (confirmação automática)</h2>
          <p className="text-sm">Cadastre este endereço no painel do gateway: <code className="break-all rounded bg-steel px-1">{webhook}</code></p>
          <div className="grid gap-3 md:grid-cols-2">{secret("webhookSecret", "Assinatura secreta do webhook")}</div>
          <p className="text-xs text-mute">Cada notificação é validada pela assinatura, o pagamento é consultado na API do gateway e o valor é conferido com o do pedido antes de aprovar. Notificações repetidas são ignoradas.</p>
        </section>

        <p className="text-xs text-mute">Segurança: as chaves secretas ficam criptografadas (AES-256-GCM) e nunca voltam para o navegador. Campos em branco mantêm o valor atual. Alterações ficam registradas na auditoria (sem os valores).</p>
        <button className="btn">Salvar pagamentos</button>
      </form>
    </div>
  );
}
