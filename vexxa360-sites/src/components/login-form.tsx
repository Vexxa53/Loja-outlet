"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { requestPasswordReset, signIn } from "@/lib/actions/auth";
import { initialState } from "@/lib/validation/common";
import { Alert, Field } from "./ui";
import { SubmitButton } from "./submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [show, setShow] = useState(false);
  const [state, action] = useActionState(signIn, initialState);
  const [resetState, resetAction] = useActionState(requestPasswordReset, initialState);

  if (mode === "reset") {
    return (
      <form action={resetAction} className="space-y-4" noValidate>
        <p className="text-sm text-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
        <Field label="E-mail" name="email" error={resetState.fieldErrors?.email}>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </Field>
        {resetState.error && <Alert kind="error">{resetState.error}</Alert>}
        {resetState.ok && <Alert kind="ok">{resetState.message}</Alert>}
        <SubmitButton className="w-full" pendingText="Enviando…">Enviar link</SubmitButton>
        <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setMode("login")}>Voltar ao login</button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" name="email" error={state.fieldErrors?.email}>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </Field>
      <Field label="Senha" name="password" error={state.fieldErrors?.password}>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="field pr-10" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
      <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setMode("reset")}>Esqueci minha senha</button>
    </form>
  );
}
