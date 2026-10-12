"use client";
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="font-serif text-3xl">Algo deu errado</h1>
        <p className="mt-2 text-muted">Tente novamente. Se o problema continuar, fale com o suporte.</p>
        <button onClick={reset} className="mt-6 rounded-full bg-ink px-6 py-3 text-sm text-white">Tentar de novo</button>
      </div>
    </main>
  );
}
