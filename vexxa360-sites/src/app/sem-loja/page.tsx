import { redirect } from "next/navigation";
import { getTenantContext, getUser, isPlatformAdmin } from "@/lib/auth/context";
import { signOut } from "@/lib/actions/auth";
import { LinkButton } from "@/components/ui";

export default async function NoStore() {
  if (!(await getUser())) redirect("/login");
  if (await getTenantContext()) redirect("/admin");
  const master = await isPlatformAdmin();
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <h1 className="font-serif text-2xl">Nenhuma loja vinculada</h1>
        <p className="mt-2 text-sm text-muted">Sua conta ainda não está vinculada a uma loja ativa. Peça à Vexxa360° para liberar seu acesso.</p>
        <div className="mt-6 flex flex-col gap-2">
          {master && <LinkButton href="/master">Ir para o painel master</LinkButton>}
          <form action={signOut}><button className="text-sm text-muted underline">Sair</button></form>
        </div>
      </div>
    </main>
  );
}
