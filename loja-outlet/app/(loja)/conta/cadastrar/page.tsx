import Link from "next/link";
import { register } from "@/app/actions/account";
import { SimpleForm } from "../AuthForm";

export const metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <div className="container-x max-w-md py-10 space-y-4"><h1 className="h-display text-3xl">Criar conta</h1>
      <SimpleForm action={register} submit="Cadastrar" fields={[{ name: "name", label: "Nome completo", autoComplete: "name" }, { name: "email", label: "E-mail", type: "email", autoComplete: "email" }, { name: "phone", label: "Telefone (opcional)", type: "optional", autoComplete: "tel" }, { name: "password", label: "Senha (mín. 10, letras e números)", type: "password", autoComplete: "new-password" }]}
        extra={<p className="text-sm text-mute">Já tem conta? <Link className="underline" href="/conta/entrar">Entrar</Link></p>} /></div>
  );
}
