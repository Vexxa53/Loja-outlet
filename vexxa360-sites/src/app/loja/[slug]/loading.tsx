export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-busy="true" aria-label="Carregando">
      <div className="h-10 w-64 animate-pulse rounded bg-soft" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-soft" />)}
      </div>
    </div>
  );
}
