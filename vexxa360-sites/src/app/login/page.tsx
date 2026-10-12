import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getUser, safeNext } from "@/lib/auth/context";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Entrar | Vexxa360° Sites", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  if (await getUser()) redirect(next || "/admin");
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center font-serif text-2xl">Vexxa360°</Link>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-1 font-serif text-2xl">Acesse seu painel</h1>
          <p className="mb-6 text-sm text-muted">Gerencie produtos, estoque e pedidos da sua loja.</p>
          {sp.erro && <div className="mb-4"><Alert kind="error">{sp.erro === "link" ? "O link é inválido ou expirou. Solicite um novo." : "Não foi possível entrar."}</Alert></div>}
          <LoginForm next={next || undefined} />
        </div>
      </div>
    </main>
  );
}
