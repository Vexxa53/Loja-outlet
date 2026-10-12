import Link from "next/link";
import clsx, { type ClassValue } from "clsx";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const cn = (...v: ClassValue[]) => clsx(v);

const btnBase = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition";
export const btnClass = {
  primary: `${btnBase} bg-brand text-on-brand hover:opacity-90`,
  secondary: `${btnBase} border border-line bg-white text-ink hover:border-ink`,
  ghost: `${btnBase} text-ink hover:bg-soft`,
};

export function LinkButton({ href, variant = "primary", className, children }: {
  href: string; variant?: keyof typeof btnClass; className?: string; children: React.ReactNode;
}) {
  return <Link href={href} className={cn(btnClass[variant], className)}>{children}</Link>;
}

export function Field({ label, name, error, hint, children }: {
  label: string; name: string; error?: string[]; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      {children}
      {hint && !error?.length && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error?.length ? <p className="mt-1 text-xs text-danger" role="alert">{error[0]}</p> : null}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const tone = kind === "ok" ? "border-ok/30 bg-ok/5 text-ok" : kind === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-line bg-soft text-ink";
  const Icon = kind === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", tone)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Mensagem vinda de ?ok= / ?erro= (ações simples de botão). */
export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null;
  return <div className="mb-5">{erro ? <Alert kind="error">{erro}</Alert> : <Alert kind="ok">{ok}</Alert>}</div>;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-line bg-white p-5", className)}>{children}</section>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-serif text-lg">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const tones: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-800", green: "bg-green-50 text-green-700",
  violet: "bg-violet-50 text-violet-700", sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700", gray: "bg-soft text-muted",
};
export function Badge({ tone = "gray", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone] ?? tones.gray)}>{children}</span>;
}

export const tableCls = {
  wrap: "overflow-x-auto rounded-2xl border border-line bg-white",
  table: "w-full min-w-[640px] text-left text-sm",
  th: "border-b border-line bg-soft/60 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted",
  td: "border-b border-line/70 px-4 py-3 align-middle last:border-b-0",
};

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? <Link className={btnClass.secondary} href={hrefFor(page - 1)}>Anterior</Link> : <span className="w-24" />}
      <span className="text-muted">Página {page} de {pages}</span>
      {page < pages ? <Link className={btnClass.secondary} href={hrefFor(page + 1)}>Próxima</Link> : <span className="w-24" />}
    </nav>
  );
}
