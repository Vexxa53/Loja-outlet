"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="h-display text-3xl">Algo deu errado</h1>
        <p className="mt-2 text-mute">Não foi possível carregar esta página agora. Tente novamente em instantes.</p>
        <button className="btn mt-4" onClick={reset}>Tentar de novo</button>
      </div>
    </div>
  );
}
