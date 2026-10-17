"use client";
import { useActionState } from "react";

type Field = { name: string; label: string; type?: string; autoComplete?: string; hidden?: string };
type Action = (s: { error?: string; ok?: string } | undefined, fd: FormData) => Promise<{ error?: string; ok?: string } | undefined>;

export function SimpleForm({ action, fields, submit, extra }: { action: Action; fields: Field[]; submit: string; extra?: React.ReactNode }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="card space-y-4 p-5">
      {fields.map((f) => f.hidden !== undefined ? <input key={f.name} type="hidden" name={f.name} value={f.hidden} /> : (
        <div key={f.name}><label className="label" htmlFor={f.name}>{f.label}</label><input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} className="input" required={f.type !== "optional"} /></div>
      ))}
      {state?.error && <p role="alert" className="flash flash-err">{state.error}</p>}
      {state?.ok && <p role="status" className="flash">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Aguarde..." : submit}</button>
      {extra}
    </form>
  );
}
