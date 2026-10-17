"use client";
import { useActionState } from "react";
import { createFirstAdmin } from "@/app/actions/admin-setup";

export function SetupForm() {
  const [s, act, pending] = useActionState(createFirstAdmin, undefined);
  const f = (name: string, label: string, type = "text", ac?: string) => (
    <label className="block"><span className="label">{label}</span><input name={name} type={type} autoComplete={ac} className="input" required /></label>
  );
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action={act} className="card w-full max-w-md space-y-4 p-6">
        <h1 className="h-display text-2xl">Instalação <span className="text-accent">da loja</span></h1>
        <p className="text-sm text-mute">Crie o administrador principal. Esta página some assim que o primeiro administrador for criado.</p>
        {f("token", "Código de instalação (SETUP_TOKEN)", "password", "off")}
        {f("name", "Seu nome", "text", "name")}
        {f("email", "E-mail de login", "email", "username")}
        {f("password", "Senha (mín. 10, letras e números)", "password", "new-password")}
        {s?.error && <p role="alert" className="flash flash-err">{s.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Criando..." : "Criar administrador"}</button>
      </form>
    </div>
  );
}
