"use client";
import { cn } from "./ui";

/** Botão de formulário que pede confirmação antes de enviar (ações destrutivas). */
export function ConfirmButton({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={cn("text-sm text-danger hover:underline", className)}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
