import Link from "next/link";
export default function StoreNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">Página não encontrada</h1>
      <p className="mt-2 text-muted">O produto ou a página que você procura não existe mais.</p>
      <Link href="/" className="mt-6 inline-block underline">Voltar ao início</Link>
    </div>
  );
}
