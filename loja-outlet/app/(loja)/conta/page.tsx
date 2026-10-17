import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { logout, updateProfile } from "@/app/actions/account";

export const metadata = { title: "Minha conta" };

export default async function Page() {
  const c = await requireCustomer();
  return (
    <div className="container-x max-w-xl py-10 space-y-6">
      <h1 className="h-display text-3xl">Olá, {c.name.split(" ")[0]}</h1>
      <nav className="flex flex-wrap gap-3"><Link className="btn btn-ghost" href="/conta/pedidos">Meus pedidos</Link><Link className="btn btn-ghost" href="/conta/enderecos">Endereços</Link><Link className="btn btn-ghost" href="/conta/privacidade">Privacidade</Link>
        <form action={logout}><button className="btn btn-ghost">Sair</button></form></nav>
      <h2 className="font-bold uppercase">Dados pessoais</h2>
      <p className="text-sm text-mute">{c.email}</p>
      <ProfileForm name={c.name} phone={c.phone ?? ""} cpf={c.cpf ?? ""} />
    </div>
  );
}

function ProfileForm({ name, phone, cpf }: { name: string; phone: string; cpf: string }) {
  return (
    <form className="card space-y-3 p-5" action={async (fd) => { "use server"; await updateProfile(undefined, fd); }}>
      <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" defaultValue={name} className="input" required /></div>
      <div><label className="label" htmlFor="phone">Telefone</label><input id="phone" name="phone" defaultValue={phone} className="input" /></div>
      <div><label className="label" htmlFor="cpf">CPF</label><input id="cpf" name="cpf" defaultValue={cpf} className="input" /></div>
      <button className="btn">Salvar</button>
    </form>
  );
}
