import { requireCustomer } from "@/lib/auth";
import { privacyRequest } from "@/app/actions/account";
import { PrivacyForm } from "./PrivacyForm";

export const metadata = { title: "Privacidade" };

export default async function Page() {
  await requireCustomer();
  return (<div className="container-x max-w-xl py-10 space-y-4"><h1 className="h-display text-3xl">Privacidade (LGPD)</h1>
    <p className="text-sm text-mute">Solicite acesso, correção ou exclusão dos seus dados pessoais.</p><PrivacyForm action={privacyRequest} /></div>);
}
