import { execSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";

const stack = path.resolve(__dirname, "stack");
const env = Object.fromEntries(readFileSync(path.join(stack, ".env"), "utf8").split("\n").filter(Boolean).map((l) => l.split("=") as [string, string]));

export const API = process.env.E2E_API ?? "http://127.0.0.1:54321";
export const ANON = env.ANON_KEY;
export const SERVICE = env.SERVICE_KEY;
export const MAIL = "http://127.0.0.1:54324";

export function psql(sql: string): string {
  return execSync(`docker compose --env-file .env exec -T db psql -U postgres -d postgres -At -c ${JSON.stringify(sql)}`, { cwd: stack, encoding: "utf8" }).trim();
}

export async function createUser(email: string, password: string) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`createUser ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()) as { id: string };
}

export async function signInToken(email: string, password: string) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`signIn ${email}: ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

/** REST do PostgREST com o JWT de um usuário (ou anon) — simula um atacante com o próprio token. */
export async function rest(token: string | null, method: string, pathAndQuery: string, body?: unknown, extra: Record<string, string> = {}) {
  const r = await fetch(`${API}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "Content-Type": "application/json", Prefer: "return=representation", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* vazio */ }
  return { status: r.status, json, text };
}

/** PNG sólido válido (cor RGB), gerado sem dependências. */
export function solidPng(w = 64, h = 80, rgb: [number, number, number] = [200, 120, 90]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Data/hora de Brasília no formato do <input type="datetime-local">. */
export function brInput(offsetMs = 0): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(Date.now() + offsetMs)).replace(" ", "T");
}

export async function latestMail(to: string, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/messages`)).json()) as { messages: { ID: string; To: { Address: string }[] }[] };
    const m = list.messages.find((x) => x.To.some((t) => t.Address === to));
    if (m) return (await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()) as { Text: string; HTML: string };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Nenhum e-mail para ${to}`);
}
