import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { memoPerRequest } from "./memo";
import { db } from "./db";
import { readSession } from "./session";
import { hasPermission, type Permission } from "./permissions";

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function passwordError(p: string): string | null {
  if (p.length < 10) return "A senha deve ter ao menos 10 caracteres.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "A senha deve conter letras e números.";
  return null;
}

export const getAdmin = memoPerRequest(async () => {
  const id = await readSession("admin");
  if (!id) return null;
  const u = await db.adminUser.findUnique({ where: { id }, include: { role: true } });
  return u && u.active ? u : null;
});

/** Garante, NO SERVIDOR, que o administrador está logado e possui a permissão. */
export async function requireAdmin(perm?: Permission) {
  const u = await getAdmin();
  if (!u) redirect("/admin/login");
  if (perm && !hasPermission(u.role.permissions, perm)) {
    redirect("/admin/sem-permissao");
  }
  return u;
}

export const getCustomer = memoPerRequest(async () => {
  const id = await readSession("customer");
  if (!id) return null;
  const c = await db.customer.findUnique({ where: { id } });
  return c && !c.anonymizedAt ? c : null;
});

export async function requireCustomer() {
  const c = await getCustomer();
  if (!c) redirect("/conta/entrar");
  return c;
}
