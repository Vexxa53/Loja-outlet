export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null;
  return <p role="status" className={`flash mb-4 ${erro ? "flash-err" : ""}`}>{erro ?? ok}</p>;
}
