import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { LOCAL_DIR } from "@/lib/storage";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Serve arquivos do armazenamento LOCAL (somente quando STORAGE_DRIVER=local: desenvolvimento e testes). */
export async function GET(_: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.STORAGE_DRIVER !== "local") return new NextResponse("Not found", { status: 404 });
  const { path: parts } = await ctx.params;
  const full = path.normalize(path.join(LOCAL_DIR, ...parts));
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!full.startsWith(LOCAL_DIR + path.sep) || !type) return new NextResponse("Not found", { status: 404 });
  try {
    return new NextResponse(new Uint8Array(await readFile(full)), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
