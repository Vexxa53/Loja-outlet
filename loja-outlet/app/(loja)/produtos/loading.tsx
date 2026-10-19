export default function Loading() {
  return (
    <div className="container-x py-10" role="status" aria-label="Carregando">
      <div className="skeleton h-56 w-full md:h-96" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>
    </div>
  );
}
