// Cria (ou redefine a senha de) um administrador. Uso (local, com DATABASE_URL apontando para o banco desejado):
//   ADMIN_EMAIL=voce@dominio.com ADMIN_NAME="Seu Nome" npm run admin:create
// A senha é pedida no terminal (sem eco) ou lida de ADMIN_PASSWORD. Nada é gravado em arquivo.
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../lib/permissions";

const db = new PrismaClient();

function ask(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // oculta a digitação
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => { if (s.includes(q)) process.stdout.write(s); };
  return new Promise((res) => rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); res(a); }));
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email.includes("@")) throw new Error("Defina ADMIN_EMAIL.");
  const password = process.env.ADMIN_PASSWORD || (await ask("Senha (mín. 10, letras e números): "));
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("Senha fraca.");
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({ where: { name: r.name }, create: { name: r.name, label: r.label, permissions: r.permissions, system: true }, update: {} });
  }
  const role = await db.role.findUniqueOrThrow({ where: { name: "admin" } });
  const passwordHash = await bcrypt.hash(password, 12);
  await db.adminUser.upsert({ where: { email }, create: { email, name, passwordHash, roleId: role.id }, update: { passwordHash, roleId: role.id, active: true } });
  console.log(`Administrador ${email} pronto.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
