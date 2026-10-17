import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { deleteAddress, saveAddress } from "@/app/actions/account";
import { SimpleForm } from "../AuthForm";

export const metadata = { title: "Endereços" };

export default async function Page() {
  const c = await requireCustomer();
  const list = await db.address.findMany({ where: { customerId: c.id }, orderBy: { isDefault: "desc" } });
  return (
    <div className="container-x max-w-xl py-10 space-y-6"><h1 className="h-display text-3xl">Endereços</h1>
      {list.map((a) => (<div key={a.id} className="card flex items-start justify-between p-4 text-sm"><p>{a.recipient}<br />{a.street}, {a.number} {a.complement} — {a.district}<br />{a.city}/{a.state} · {a.zip}</p>
        <form action={deleteAddress}><input type="hidden" name="id" value={a.id} /><button className="text-mute underline">Excluir</button></form></div>))}
      <h2 className="font-bold uppercase">Novo endereço</h2>
      <SimpleForm action={saveAddress} submit="Salvar endereço" fields={[
        { name: "recipient", label: "Destinatário" }, { name: "zip", label: "CEP" }, { name: "street", label: "Rua" }, { name: "number", label: "Número" },
        { name: "complement", label: "Complemento", type: "optional" }, { name: "district", label: "Bairro" }, { name: "city", label: "Cidade" }, { name: "state", label: "UF" }]} />
    </div>
  );
}
