"use client";
import { useActionState } from "react";
import { adminLogin } from "@/app/actions/admin-auth";

export default function AdminLogin() {
  const [s, act, pending] = useActionState(adminLogin, undefined);
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action={act} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="h-display text-2xl">Painel <span className="text-accent">admin</span></h1>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" className="input" required /></div>
        <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" className="input" required /></div>
        {s?.error && <p role="alert" className="flash flash-err">{s.error}</p>}
        <button className="btn w-full" disabled={pending}>Entrar</button>
      </form>
    </div>
  );
}
