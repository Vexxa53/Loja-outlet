import { resetPassword } from "@/app/actions/account";
import { SimpleForm } from "../../AuthForm";

export const metadata = { title: "Nova senha", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (<div className="container-x max-w-md py-10 space-y-4"><h1 className="h-display text-3xl">Nova senha</h1>
    <SimpleForm action={resetPassword} submit="Salvar" fields={[{ name: "token", label: "", hidden: token }, { name: "password", label: "Nova senha (mín. 10, letras e números)", type: "password", autoComplete: "new-password" }]} /></div>);
}
