// Gera chaves JWT (HS256) para a pilha Supabase local de TESTE. Nada aqui é segredo de produção.
import { createHmac, randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const file = new URL("./.env", import.meta.url);
if (existsSync(file)) { console.log(readFileSync(file, "utf8")); process.exit(0); }

const secret = randomBytes(24).toString("hex");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ iss: "supabase-local", role, iat: 1700000000, exp: 2000000000 });
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
};
const out = `JWT_SECRET=${secret}\nANON_KEY=${sign("anon")}\nSERVICE_KEY=${sign("service_role")}\nPOSTGRES_PASSWORD=postgres\n`;
writeFileSync(file, out);
console.log(out);
