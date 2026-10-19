// Gera public/catalogo/<SKU>.webp (900x1200, 3:4) a partir de catalog/sources.json.
// Fotos do Unsplash (Unsplash License: uso comercial livre, sem atribuição obrigatória). Uso: node scripts/build-catalog-images.mjs [pasta-cache]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const cache = process.argv[2] ?? ".catalog-cache";
const sources = JSON.parse(readFileSync("catalog/sources.json", "utf8"));
mkdirSync(cache, { recursive: true });
mkdirSync("public/catalogo", { recursive: true });

for (const [sku, v] of Object.entries(sources)) {
  const file = path.join(cache, `${sku}.jpg`);
  if (!existsSync(file)) {
    const res = await fetch(`https://images.unsplash.com/photo-${v.id}?fm=jpg&q=85&w=1600&auto=format`);
    if (!res.ok) throw new Error(`${sku}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const position = v.crop === "top" ? "north" : v.crop === "bottom" ? "south" : sharp.strategy.attention;
  let img = sharp(file).rotate();
  if (v.region) { // usa só a parte de cima da foto (fração da altura): corta calçados com marca no rodapé
    const m = await sharp(await img.toBuffer()).metadata();
    img = sharp(await img.extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * v.region) }).toBuffer());
  }
  const buf = await img.resize(900, 1200, { fit: "cover", position }).webp({ quality: 78, effort: 5 }).toBuffer();
  writeFileSync(`public/catalogo/${sku}.webp`, buf);
  console.log(sku, `${Math.round(buf.length / 1024)} KB`);
}
