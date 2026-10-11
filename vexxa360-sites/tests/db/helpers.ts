import { Pool, type PoolClient } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DB_URL = process.env.TEST_DATABASE_URL;
const root = path.resolve(__dirname, "../../supabase");

export const pool = DB_URL ? new Pool({ connectionString: DB_URL, max: 25 }) : (undefined as unknown as Pool);

/** Recria o banco de teste do zero: stub do Supabase + TODAS as migrações em ordem. */
export async function resetDb() {
  const c = await pool.connect();
  try {
    await c.query("drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;");
    const files = [
      path.join(root, "tests/00_supabase_stub.sql"),
      ...readdirSync(path.join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => path.join(root, "migrations", f)),
    ];
    for (const f of files) await c.query(readFileSync(f, "utf8"));
    // No Supabase real o service_role já recebe estes privilégios por padrão.
    await c.query(`grant all on all tables in schema public to service_role;
                   grant all on all sequences in schema public to service_role;`);
  } finally {
    c.release();
  }
}

type Role = "anon" | "authenticated" | "service_role" | "postgres";

/** Executa fn numa transação com o papel/usuário informado (como o PostgREST faz). */
export async function as<T>(role: Role, uid: string | null, fn: (c: PoolClient) => Promise<T>, commit = false): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (role !== "postgres") await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const out = await fn(c);
    await c.query(commit ? "commit" : "rollback");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Retorna a mensagem do erro (ou null se a consulta foi aceita). */
export async function errorOf(role: Role, uid: string | null, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await as(role, uid, (c) => c.query(sql, params));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function rows(role: Role, uid: string | null, sql: string, params: unknown[] = []) {
  return as(role, uid, async (c) => (await c.query(sql, params)).rows);
}

export const su = (sql: string, params: unknown[] = []) => pool.query(sql, params);

export type Seed = Awaited<ReturnType<typeof seed>>;

export async function seed() {
  const id = () => randomUUID();
  const [ua, ub, sa, uc, master] = [id(), id(), id(), id(), id()];
  for (const [u, n] of [[ua, "a-owner"], [ub, "b-owner"], [sa, "a-staff"], [uc, "nobody"], [master, "master"]] as const) {
    await su("insert into auth.users (id, email) values ($1, $2)", [u, `${n}@teste.com`]);
  }
  const A = (await su("insert into tenants (name, slug) values ('Loja A', 'loja-a') returning id")).rows[0].id as string;
  const B = (await su("insert into tenants (name, slug) values ('Loja B', 'loja-b') returning id")).rows[0].id as string;
  const C = (await su("insert into tenants (name, slug) values ('Loja Oculta', 'loja-oculta') returning id")).rows[0].id as string;
  await su("insert into store_settings (tenant_id, store_name, whatsapp, published) values ($1,'Loja A','5511999990001',true),($2,'Loja B','5511999990002',true),($3,'Loja Oculta','5511999990003',false)", [A, B, C]);
  await su("insert into memberships (tenant_id, user_id, role) values ($1,$2,'owner'),($3,$4,'owner'),($1,$5,'staff')", [A, ua, B, ub, sa]);
  await su("insert into platform_admins (user_id) values ($1)", [master]);

  async function product(tenant: string, name: string, price: number, opts: { status?: string; stock?: Record<string, number>; promo?: number } = {}) {
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const p = (await su(
      "insert into products (tenant_id, name, slug, regular_price, promotional_price, status) values ($1,$2,$3,$4,$5,$6) returning id",
      [tenant, name, slug, price, opts.promo ?? null, opts.status ?? "published"],
    )).rows[0].id as string;
    const variants: Record<string, string> = {};
    for (const [key, qty] of Object.entries(opts.stock ?? { "P|Preta": 5 })) {
      const [size, color] = key.split("|");
      variants[key] = (await su("insert into product_variants (tenant_id, product_id, size, color, stock_quantity) values ($1,$2,$3,$4,$5) returning id", [tenant, p, size, color, qty])).rows[0].id as string;
    }
    return { id: p, variants };
  }
  return { ua, ub, sa, uc, master, A, B, C, product };
}
