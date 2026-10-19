"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type State = { ok?: string; error?: string } | undefined;

/** Cadastro de e-mail para novidades. Exige consentimento explícito (LGPD) e é idempotente. */
export async function subscribeNewsletter(_: State, fd: FormData): Promise<State> {
  if (fd.get("consent") !== "on") return { error: "Marque a caixa para autorizar o envio de e-mails." };
  const email = z.string().trim().toLowerCase().email().max(160).safeParse(fd.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  if (!(await rateLimit(`news:${await clientIp()}`, 8, 3600))) return { error: "Muitas tentativas. Tente de novo mais tarde." };
  await db.newsletterSignup.upsert({ where: { email: email.data }, create: { email: email.data, source: "site" }, update: {} });
  return { ok: "Pronto! Seu e-mail foi cadastrado. Você pode sair da lista quando quiser, pedindo pelo e-mail de contato." };
}
