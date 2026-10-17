import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Kind = "admin" | "customer";
const COOKIE: Record<Kind, string> = { admin: "lo_admin", customer: "lo_customer" };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function createSession(kind: Kind, userId: string) {
  const maxAge = kind === "admin" ? 60 * 60 * 8 : 60 * 60 * 24 * 14;
  const token = await new SignJWT({ kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());
  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function readSession(kind: Kind): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.kind === kind && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function destroySession(kind: Kind) {
  (await cookies()).delete(COOKIE[kind]);
}
