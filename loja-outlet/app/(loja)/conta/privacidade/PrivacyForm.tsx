"use client";
import { useActionState } from "react";

export function PrivacyForm({ action }: { action: (s: { error?: string; ok?: string } | undefined, fd: FormData) => Promise<{ error?: string; ok?: string } | undefined> }) {
  const [s, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="card space-y-3 p-5">
      <label className="label" htmlFor="kind">Tipo</label>
      <select id="kind" name="kind" className="input"><option value="ACCESS">Acesso aos meus dados</option><option value="CORRECTION">Correção de dados</option><option value="DELETE">Exclusão da conta e dos dados</option></select>
      <label className="label" htmlFor="note">Detalhes (opcional)</label><textarea id="note" name="note" className="input" maxLength={500} />
      {s?.ok && <p className="flash">{s.ok}</p>}{s?.error && <p className="flash flash-err">{s.error}</p>}
      <button className="btn" disabled={pending}>Enviar solicitação</button>
    </form>
  );
}
