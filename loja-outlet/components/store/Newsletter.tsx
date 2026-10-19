"use client";
import Link from "next/link";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";

export function Newsletter({ name }: { name: string }) {
  const [s, act, pending] = useActionState(subscribeNewsletter, undefined);
  return (
    <section aria-labelledby="news-title" className="border-b border-steel bg-ink">
      <div className="container-x grid gap-4 py-8 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div>
          <h2 id="news-title" className="h-display text-2xl">Fique por dentro</h2>
          <p className="mt-1 text-sm text-mute">Receba lançamentos e ofertas da {name} no seu e-mail.</p>
        </div>
        <form action={act} className="space-y-2" noValidate={false}>
          <div className="flex gap-2">
            <label htmlFor="news-email" className="sr-only">Seu e-mail</label>
            <input id="news-email" name="email" type="email" required autoComplete="email" placeholder="Seu melhor e-mail" className="input" />
            <button className="btn shrink-0" disabled={pending}>{pending ? "Enviando..." : "Quero receber"}</button>
          </div>
          <label className="flex items-start gap-2 text-xs text-mute"><input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Concordo em receber e-mails de novidades e ofertas. Posso cancelar quando quiser. </span></label>
            <Link className="inline-flex min-h-11 items-center text-xs underline" href="/politicas/privacidade">Ler a política de privacidade</Link>
          {s?.ok && <p role="status" className="flash">{s.ok}</p>}
          {s?.error && <p role="alert" className="flash flash-err">{s.error}</p>}
        </form>
      </div>
    </section>
  );
}
