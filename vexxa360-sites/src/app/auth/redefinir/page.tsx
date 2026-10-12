"use client";
import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import { initialState } from "@/lib/validation/common";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, initialState);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-white p-6 sm:p-8" noValidate>
        <h1 className="font-serif text-2xl">Criar nova senha</h1>
        <Field label="Nova senha" name="password" error={state.fieldErrors?.password} hint="Mínimo de 8 caracteres.">
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="field" />
        </Field>
        <Field label="Confirmar senha" name="confirm" error={state.fieldErrors?.confirm}>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
        </Field>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <SubmitButton className="w-full" pendingText="Salvando…">Salvar senha</SubmitButton>
      </form>
    </main>
  );
}
