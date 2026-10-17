"use client";
import { useActionState } from "react";
import { placeOrder } from "@/app/actions/checkout";

type D = Record<"name" | "email" | "phone" | "street" | "number" | "complement" | "district" | "city" | "state", string>;

export function CheckoutForm({ zip, idempotencyKey, defaults }: { zip: string; idempotencyKey: string; defaults: D }) {
  const [state, action, pending] = useActionState(placeOrder, undefined);
  const f = (name: keyof D, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={defaults[name]} className="input" {...extra} /></div>
  );
  return (
    <form action={action} className="card space-y-4 p-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="zip" value={zip} />
      <h2 className="font-bold uppercase">Identificação</h2>
      <div className="grid gap-3 md:grid-cols-2">{f("name", "Nome completo", { required: true, autoComplete: "name" })}{f("email", "E-mail", { type: "email", required: true, autoComplete: "email" })}{f("phone", "Telefone", { autoComplete: "tel" })}</div>
      <h2 className="font-bold uppercase">Entrega — CEP {zip}</h2>
      <div className="grid gap-3 md:grid-cols-2">{f("street", "Rua", { required: true })}{f("number", "Número", { required: true })}{f("complement", "Complemento")}{f("district", "Bairro", { required: true })}{f("city", "Cidade", { required: true })}{f("state", "UF", { required: true, maxLength: 2 })}</div>
      <h2 className="font-bold uppercase">Pagamento</h2>
      <p className="text-sm text-mute">Você será redirecionado ao Mercado Pago para pagar com Pix, cartão ou boleto. Não armazenamos dados de cartão.</p>
      {state?.error && <p role="alert" className="flash flash-err">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Processando..." : "Confirmar pedido"}</button>
    </form>
  );
}
