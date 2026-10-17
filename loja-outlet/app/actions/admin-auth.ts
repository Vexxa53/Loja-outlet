"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

export async function adminLogin(_: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const p = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Credenciais inválidas." };
  const ip = await clientIp();
  if (!(await rateLimit(`alogin:${ip}:${p.data.email}`, 5, 900)) || !(await rateLimit(`alogin-ip:${ip}`, 30, 900))) return { error: "Muitas tentativas. Aguarde 15 minutos." };
  const u = await db.adminUser.findUnique({ where: { email: p.data.email } });
  if (!u || !u.active || !(await verifyPassword(p.data.password, u.passwordHash))) return { error: "Credenciais inválidas." };
  await createSession("admin", u.id);
  await audit(u.id, "login", "AdminUser", u.id);
  redirect("/admin");
}

export async function adminLogout() {
  await destroySession("admin");
  redirect("/admin/login");
}
