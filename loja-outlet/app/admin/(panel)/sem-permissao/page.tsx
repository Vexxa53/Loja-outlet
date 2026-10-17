import { requireAdmin } from "@/lib/auth";

export default async function Page() {
  await requireAdmin();
  return (<div className="card max-w-lg p-6"><h1 className="h-display text-2xl">Sem permissão</h1><p className="mt-2 text-mute">Seu perfil não tem acesso a esta área. Peça ao administrador para ajustar suas permissões.</p></div>);
}
