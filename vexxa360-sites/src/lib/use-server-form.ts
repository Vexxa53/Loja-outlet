"use client";
import { useCallback, useState, useTransition } from "react";
import type { ActionState } from "./validation/common";

/**
 * Envia o formulário para uma Server Action SEM deixar o React 19 limpar os campos
 * (com `<form action>` os campos voltam ao valor inicial após qualquer envio — inclusive após
 * erro de validação, o que apagaria o que a pessoa digitou).
 */
export function useServerForm(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => setState(await action({}, fd)));
    },
    [action],
  );
  return { state, pending, onSubmit };
}
