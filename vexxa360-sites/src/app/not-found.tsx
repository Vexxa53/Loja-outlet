import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="font-serif text-4xl">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço não existe ou foi removido.</p>
        <Link href="/" className="mt-6 inline-block underline">Ir para o início</Link>
      </div>
    </main>
  );
}
