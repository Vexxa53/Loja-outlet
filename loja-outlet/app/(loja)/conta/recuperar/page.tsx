import { requestReset } from "@/app/actions/account";
import { SimpleForm } from "../AuthForm";

export const metadata = { title: "Recuperar senha" };

export default function Page() {
  return (<div className="container-x max-w-md py-10 space-y-4"><h1 className="h-display text-3xl">Recuperar senha</h1>
    <SimpleForm action={requestReset} submit="Enviar link" fields={[{ name: "email", label: "E-mail", type: "email" }]} /></div>);
}
