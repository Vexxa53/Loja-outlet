import Link from "next/link";
import { login } from "@/app/actions/account";
import { SimpleForm } from "../AuthForm";

export const metadata = { title: "Entrar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ redefinida?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-md py-10 space-y-4"><h1 className="h-display text-3xl">Entrar</h1>
      {sp.redefinida && <p className="flash">Senha redefinida. Faça login.</p>}
      <SimpleForm action={login} submit="Entrar" fields={[{ name: "email", label: "E-mail", type: "email", autoComplete: "email" }, { name: "password", label: "Senha", type: "password", autoComplete: "current-password" }]}
        extra={<p className="text-sm text-mute"><Link className="underline" href="/conta/recuperar">Esqueci a senha</Link> · <Link className="underline" href="/conta/cadastrar">Criar conta</Link></p>} /></div>
  );
}
