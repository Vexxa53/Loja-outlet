"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Salvando...", className = "btn", ...rest }: { pendingText?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={pending || rest.disabled} className={className} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
