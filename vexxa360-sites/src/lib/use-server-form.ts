"use client";
import { useCallback, useState, useTransition } from "react";
import type { ActionState } from "./validation/common";

/**
 * Envia o formulário para uma Server Action SEM deixar o React 19 limpar os campos
 * (com `<form action>` os campos voltam ao valor inicial após qualquer envio — inclusive após
 * erro de validação, o que apagaria o que a pessoa digitou).
 */
export function useServerForm(action: (prev: ActionState, fd: FormData) => Promise<ActionState>, opts: { resetOnSuccess?: boolean } = {}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      setState({}); // some a mensagem anterior enquanto o novo envio roda
      start(async () => {
        const result = await action({}, fd);
        if (result.ok && opts.resetOnSuccess) form.reset(); // junto com a mensagem, no mesmo instante
        setState(result);
      });
    },
    [action, opts.resetOnSuccess],
  );
  return { state, pending, onSubmit };
}
