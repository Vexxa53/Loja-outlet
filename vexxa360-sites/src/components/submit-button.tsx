"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "./ui";

export function SubmitButton({ children, className, pendingText, variant = "primary", pending: pendingProp }: {
  children: React.ReactNode; className?: string; pendingText?: string; variant?: "primary" | "secondary" | "danger"; pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      className={cn(btn(variant), "disabled:cursor-not-allowed disabled:opacity-60", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

function btn(variant: "primary" | "secondary" | "danger") {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition";
  if (variant === "secondary") return `${base} border border-line bg-white text-ink hover:border-ink`;
  if (variant === "danger") return `${base} bg-danger text-white hover:opacity-90`;
  return `${base} bg-brand text-on-brand hover:opacity-90`;
}
