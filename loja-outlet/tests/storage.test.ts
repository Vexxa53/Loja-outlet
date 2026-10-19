import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_DIR, MAX_BYTES, deleteImage, uploadImage, validateImage } from "../lib/storage";
import { makePng, makeJpeg, makeWebp } from "../e2e/images";

const fileOf = (buf: Buffer, name: string, type: string) => new File([new Uint8Array(buf)], name, { type });
const env = (k: string, v?: string) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };

afterEach(() => { env("STORAGE_DRIVER"); env("SUPABASE_URL"); env("SUPABASE_SERVICE_ROLE_KEY"); env("SUPABASE_BUCKET"); });

describe("validação de imagem (pelo conteúdo real)", () => {
  it("aceita JPG, PNG e WebP", () => {
    for (const b of [makePng(), makeJpeg(), makeWebp()]) expect("type" in validateImage({ size: b.length }, b)).toBe(true);
  });
  it("recusa arquivo que só tem extensão de imagem", () => {
    const fake = Buffer.from("isto não é uma imagem <script>alert(1)</script>");
    expect(validateImage({ size: fake.length }, fake)).toEqual({ error: expect.stringContaining("Formato não aceito") });
  });
  it("recusa SVG, GIF e arquivo vazio", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00");
    expect("error" in validateImage({ size: svg.length }, svg)).toBe(true);
    expect("error" in validateImage({ size: gif.length }, gif)).toBe(true);
    expect("error" in validateImage({ size: 0 }, Buffer.alloc(0))).toBe(true);
  });
  it("recusa acima de 4 MB", () => {
    const big = Buffer.concat([makePng(), Buffer.alloc(MAX_BYTES)]);
    expect(validateImage({ size: big.length }, big)).toEqual({ error: expect.stringContaining("4 MB") });
  });
});

describe("armazenamento local (dev/testes)", () => {
  it("grava, devolve URL /uploads/... e remove", async () => {
    env("STORAGE_DRIVER", "local");
    const up = await uploadImage(fileOf(makePng(), "foto.png", "image/png"), "test/unit");
    expect(up.url).toBe(`/uploads/${up.path}`);
    expect(up.path).toMatch(/^test\/unit\/[0-9a-f-]{36}\.png$/);
    expect(existsSync(path.join(LOCAL_DIR, up.path))).toBe(true);
    await deleteImage(up.path);
    expect(existsSync(path.join(LOCAL_DIR, up.path))).toBe(false);
  });
  it("rejeita arquivo inválido sem gravar", async () => {
    env("STORAGE_DRIVER", "local");
    await expect(uploadImage(fileOf(Buffer.from("texto"), "x.png", "image/png"), "test/unit")).rejects.toThrow(/Formato não aceito/);
  });
  it("sanitiza a pasta (sem ../)", async () => {
    env("STORAGE_DRIVER", "local");
    const up = await uploadImage(fileOf(makeJpeg(), "a.jpg", "image/jpeg"), "../../etc/passwd");
    expect(up.path.startsWith("etcpasswd/") || !up.path.includes("..")).toBe(true);
    await deleteImage(up.path);
  });
});

describe("Supabase Storage (API simulada)", () => {
  it("envia com apikey, tipo real e devolve URL pública do bucket", async () => {
    const seen: { method?: string; url?: string; headers: http.IncomingHttpHeaders; size: number }[] = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { seen.push({ method: req.method, url: req.url, headers: req.headers, size: Buffer.concat(chunks).length }); res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    env("SUPABASE_URL", `http://127.0.0.1:${port}`); env("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste"); env("SUPABASE_BUCKET", "Loja");
    try {
      const png = makePng();
      const up = await uploadImage(fileOf(png, "foto.png", "image/png"), "products/abc");
      expect(seen[0].method).toBe("POST");
      expect(seen[0].url).toMatch(/^\/storage\/v1\/object\/Loja\/products\/abc\/[0-9a-f-]{36}\.png$/);
      expect(seen[0].headers.apikey).toBe("sb_secret_teste");
      expect(seen[0].headers.authorization).toBeUndefined(); // chave nova (sb_) não é JWT
      expect(seen[0].headers["content-type"]).toBe("image/png");
      expect(seen[0].size).toBe(png.length);
      expect(up.url).toBe(`http://127.0.0.1:${port}/storage/v1/object/public/Loja/${up.path}`);
      await deleteImage(up.path);
      expect(seen[1].method).toBe("DELETE");
      expect(seen[1].url).toBe(`/storage/v1/object/Loja/${up.path}`);
    } finally { server.close(); }
  });
  it("mostra mensagem clara quando o armazenamento recusa", async () => {
    const server = http.createServer((_, res) => { res.writeHead(404); res.end("{}"); });
    await new Promise<void>((r) => server.listen(0, r));
    env("SUPABASE_URL", `http://127.0.0.1:${(server.address() as { port: number }).port}`); env("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x");
    try { await expect(uploadImage(fileOf(makePng(), "f.png", "image/png"), "a")).rejects.toThrow(/bucket/); } finally { server.close(); }
  });
  it("avisa quando o armazenamento não está configurado", async () => {
    await expect(uploadImage(fileOf(makePng(), "f.png", "image/png"), "a")).rejects.toThrow(/não foi configurado/);
  });
});
