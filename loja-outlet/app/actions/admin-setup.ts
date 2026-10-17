"use server";
import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordError } from "@/lib/auth";
import { DEFAULT_ROLES } from "@/lib/permissions";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { rateLimit, clientIp } from "@/lib/ratelimit";

function tokenOk(given: string): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length < 20) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cria o PRIMEIRO administrador. Só funciona sem nenhum admin cadastrado e com o SETUP_TOKEN correto. */
export async function createFirstAdmin(_: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  if (!(await rateLimit(`setup:${await clientIp()}`, 10, 900))) return { error: "Muitas tentativas. Aguarde 15 minutos." };
  const p = z.object({ token: z.string().max(200), name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email(), password: z.string().max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Preencha nome, e-mail válido, senha e o código de instalação." };
  if (!tokenOk(p.data.token)) return { error: "Código de instalação inválido." };
  const pe = passwordError(p.data.password);
  if (pe) return { error: pe };
  if ((await db.adminUser.count()) > 0) return { error: "A instalação já foi concluída. Faça login." };
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({ where: { name: r.name }, create: { name: r.name, label: r.label, permissions: r.permissions, system: true }, update: {} });
  }
  if ((await db.category.count()) === 0) await db.category.createMany({ data: DEFAULT_CATEGORIES, skipDuplicates: true });
  const role = await db.role.findUniqueOrThrow({ where: { name: "admin" } });
  await db.adminUser.create({ data: { email: p.data.email, name: p.data.name, passwordHash: await hashPassword(p.data.password), roleId: role.id } });
  redirect("/admin/login");
}
