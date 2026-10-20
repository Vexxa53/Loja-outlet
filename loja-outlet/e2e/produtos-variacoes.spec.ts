import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { clearLimits } from "./limits";
import { expect, test, type Page } from "@playwright/test";
import { expectCount, pickColor, pickSize, setStock, stockInput } from "./variants";

const db = new PrismaClient();
const stamp = Date.now().toString(36).toUpperCase();
const skus: string[] = [];
const sku = (n: string) => { const s = `V${stamp}-${n}`; skus.push(s); return s; };

test.beforeEach(clearLimits);
test.afterAll(async () => {
  await db.product.deleteMany({ where: { sku: { in: skus } } });
  await db.adminUser.deleteMany({ where: { email: `gp${stamp.toLowerCase()}@teste.local` } });
});

async function login(page: Page, email = "admin@teste.local", pass = "SenhaTeste123") {
  await page.goto("/admin/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.endsWith("/login"));
}
const watch = (page: Page) => {
  const bad: string[] = [];
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (400|401|403|404)|Failed to load resource|ERR_FAILED|fetch/.test(m.text())) bad.push(`console: ${m.text()}`); });
  return bad;
};
async function basics(page: Page, code: string, category: string, status = "DRAFT") {
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome do produto").fill(`Produto ${code}`);
  await page.getByLabel("Código (SKU)").fill(code);
  await page.getByLabel("Preço de venda (R$)").fill("199,90");
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: category });
  await page.getByLabel("Situação na loja").selectOption(status);
}
const save = (page: Page) => page.getByRole("button", { name: /Cadastrar produto|Salvar alterações/ }).click();
const NEED = "Selecione pelo menos um tamanho para este calçado.";

test("A/C: calçado sem numeração é barrado; todas as grades; categoria muda sugestões sem perder seleção", async ({ page }) => {
  const bad = watch(page);
  await login(page);
  const s = sku("A");
  await basics(page, s, "Tênis");
  await expect(page.getByTestId("kind-note")).toContainText("Calçados");
  for (const n of ["34", "38", "44"]) await expect(page.getByRole("button", { name: n, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tamanho único" })).toHaveCount(0); // calçado não tem "único"
  await save(page);
  await expect(page.locator("p[role=alert]", { hasText: NEED }).first()).toBeVisible();
  expect(await db.product.count({ where: { sku: s } })).toBe(0);
  expect(page.url()).toContain("/admin/produtos/novo");
  // publicar também é barrado
  await page.getByLabel("Situação na loja").selectOption("PUBLISHED");
  await save(page);
  await expect(page.locator("p[role=alert]", { hasText: NEED }).first()).toBeVisible();
  expect(await db.product.count({ where: { sku: s } })).toBe(0);
  // numeração inválida como tamanho personalizado
  await page.getByLabel("Adicionar tamanho personalizado").fill("M");
  await page.getByRole("button", { name: "Adicionar tamanho" }).click();
  await expect(page.getByText(/exige numeração válida/).first()).toBeVisible();
  // selecionar 38 e trocar a categoria: 38 permanece selecionado, sugestões mudam
  await pickSize(page, "38");
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "Camisas" });
  await expect(page.getByRole("button", { name: "PP", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "38", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Tipo de grade: .*Camisetas/)).toBeVisible();
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "Tênis" });
  await expect(page.getByRole("button", { name: "38", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(bad).toEqual([]);
});

test("B/E/F: tênis com 4 numerações × 2 cores, combinações desativadas, estoque individual e validações", async ({ page }) => {
  const bad = watch(page);
  await login(page);
  const s = sku("B");
  await basics(page, s, "Tênis", "PUBLISHED");
  for (const n of ["37", "38", "39", "40"]) await pickSize(page, n);
  await pickColor(page, "Preto"); await pickColor(page, "Branco");
  await expectCount(page, 8);
  // nem toda numeração existe nas duas cores: desativa 37/Branco e 40/Branco
  await page.getByLabel("Criar 37 Branco", { exact: true }).uncheck();
  await page.getByLabel("Criar 40 Branco", { exact: true }).uncheck();
  await expectCount(page, 6);
  // vazio é erro (não vira zero)
  await save(page);
  await expect(page.locator("p[role=alert]", { hasText: /Informe o estoque/ }).first()).toBeVisible();
  const data: Record<string, string> = { "37|Preto": "4", "38|Preto": "8", "39|Preto": "6", "40|Preto": "3", "38|Branco": "5", "39|Branco": "2" };
  for (const [k, v] of Object.entries(data)) { const [sz, c] = k.split("|"); await setStock(page, sz, c, v); }
  // inválidos: negativo, decimal, texto
  for (const bad of ["-1", "1.5", "abc"]) { await setStock(page, "38", "Preto", bad); await save(page); await expect(page.locator("p[role=alert]", { hasText: /estoque/i }).first()).toBeVisible(); }
  expect(await db.product.count({ where: { sku: s } })).toBe(0);
  await setStock(page, "38", "Preto", "8");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();
  // persistência real: banco e tela recarregada
  const p = await db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });
  expect(p.variants.length).toBe(6);
  for (const [k, v] of Object.entries(data)) { const [sz, c] = k.split("|"); expect(p.variants.find((x) => x.size === sz && x.color === c)!.stock, k).toBe(Number(v)); }
  expect(p.variants.some((x) => x.size === "37" && x.color === "Branco")).toBe(false);
  await page.reload();
  await expectCount(page, 6);
  for (const [k, v] of Object.entries(data)) { const [sz, c] = k.split("|"); await expect(stockInput(page, sz, c)).toHaveValue(v); }

  // F: altera só 39/Preto
  await setStock(page, "39", "Preto", "11");
  await save(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  const q = await db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });
  expect(Object.fromEntries(q.variants.map((x) => [`${x.size}|${x.color}`, x.stock]))).toEqual({ ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Number(v)])), "39|Preto": 11 });
  await expect(stockInput(page, "39", "Preto")).toHaveValue("11");
  expect(await db.stockMovement.count({ where: { variant: { productId: p.id }, type: "ADJUSTMENT" } })).toBe(1);

  // desmarcar um tamanho já cadastrado só INATIVA (estoque preservado) e a loja não oferece mais
  await page.getByRole("button", { name: "40", exact: true }).click();
  await save(page);
  await expect.poll(async () => (await db.variant.findFirstOrThrow({ where: { productId: p.id, size: "40" } })).active).toBe(false);
  expect((await db.variant.findFirstOrThrow({ where: { productId: p.id, size: "40" } })).stock).toBe(3);
  expect(await db.variant.count({ where: { productId: p.id, size: "40", active: true } })).toBe(0);
  expect(bad).toEqual([]);
});

test("D: camisetas com cor personalizada e só alguns tamanhos", async ({ page }) => {
  await login(page);
  const s = sku("D");
  await basics(page, s, "Camisas", "PUBLISHED");
  for (const n of ["P", "M", "G"]) await pickSize(page, n);
  await expect(page.getByRole("button", { name: "GG", exact: true })).toHaveAttribute("aria-pressed", "false");
  await pickColor(page, "Verde-militar"); await pickColor(page, "Preto");
  await expect(page.getByRole("button", { name: "Verde-militar", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectCount(page, 6);
  await page.getByLabel("Estoque das linhas novas ainda vazias:").fill("2");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await setStock(page, "M", "Verde-militar", "9");
  await save(page);
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();
  const p = await db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });
  expect(p.variants.length).toBe(6);
  expect(p.variants.find((x) => x.size === "M" && x.color === "Verde-militar")!.stock).toBe(9);
  expect(p.variants.find((x) => x.size === "M" && x.color === "Verde-militar")!.sku).toBe(`${s}-M-VERDE-MILITAR`);
  // editar sem mexer no resto
  await page.getByLabel("Marca — opcional").fill("Marca Teste");
  await save(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  const q = await db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });
  expect(q.brand).toBe("Marca Teste"); expect(q.variants.map((x) => x.stock).sort()).toEqual(p.variants.map((x) => x.stock).sort());
});

test("H: relógio sem variações de tamanho/cor; produto antigo (G) preserva estoques", async ({ page }) => {
  await login(page);
  const s = sku("H");
  await basics(page, s, "Relógios", "PUBLISHED");
  await page.getByRole("button", { name: "Tamanho único" }).click();
  await page.getByRole("button", { name: "Sem variação de cor" }).click();
  await expectCount(page, 1);
  await setStock(page, "Único", "Único", "5");
  await save(page);
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();
  const p = await db.product.findUniqueOrThrow({ where: { sku: s }, include: { variants: true } });
  expect(p.variants.map((x) => [x.size, x.color, x.stock])).toEqual([["Único", "Único", 5]]);
  // vitrine: compra direta sem exigir cor
  const store = await page.context().newPage();
  await store.goto(`/produto/${p.slug}`);
  await expect(store.getByText(/^Cor:/)).toHaveCount(0);
  await expect(store.getByRole("button", { name: "Comprar" })).toBeVisible();

  // G: produto antigo do catálogo inicial — altera só a marca; estoques idênticos
  const old = await db.product.findFirst({ where: { sku: { startsWith: "OUT3K-CAM-" } }, include: { variants: { orderBy: { sku: "asc" } } } });
  test.skip(!old, "catálogo inicial não instalado neste banco");
  await page.goto(`/admin/produtos/${old!.id}`);
  const brandBefore = old!.brand;
  await page.getByLabel("Marca — opcional").fill(`${brandBefore ?? ""}X`);
  await save(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  const after = await db.product.findUniqueOrThrow({ where: { id: old!.id }, include: { variants: { orderBy: { sku: "asc" } } } });
  expect(after.variants.map((v) => [v.sku, v.size, v.color, v.stock, v.active])).toEqual(old!.variants.map((v) => [v.sku, v.size, v.color, v.stock, v.active]));
  await db.product.update({ where: { id: old!.id }, data: { brand: brandBefore } });
});

test("I: clique duplo cria um só produto; falha de rede preserva dados; aviso de alterações não salvas", async ({ page }) => {
  const bad = watch(page);
  await login(page);
  const s = sku("I");
  await basics(page, s, "Camisas", "DRAFT");
  await pickSize(page, "M"); await pickColor(page, "Preto"); await setStock(page, "M", "Preto", "3");
  // rede fora do ar: nada salvo, dados preenchidos continuam, mensagem clara
  await page.route("**/*", (r) => (r.request().method() === "POST" ? r.abort() : r.continue()));
  await save(page);
  await expect(page.getByText(/Falha de conexão/)).toBeVisible();
  await expect(page.getByLabel("Nome do produto")).toHaveValue(`Produto ${s}`);
  await expect(stockInput(page, "M", "Preto")).toHaveValue("3");
  expect(await db.product.count({ where: { sku: s } })).toBe(0);
  await page.unroute("**/*");
  // clique duplo
  await page.getByRole("button", { name: "Cadastrar produto" }).dblclick();
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();
  expect(await db.product.count({ where: { sku: s } })).toBe(1);
  // aviso antes de descartar alterações
  await page.getByLabel("Marca — opcional").fill("alterada");
  const dialogs: string[] = [];
  page.once("dialog", (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect(dialogs.join()).toMatch(/Descartar/);
  expect(page.url()).toMatch(/\/admin\/produtos\/[a-z0-9]+/);
  expect(bad).toEqual([]);
});

test("I: perfil sem permissão de estoque não altera quantidades de variações cadastradas", async ({ page }) => {
  const email = `gp${stamp.toLowerCase()}@teste.local`;
  const role = await db.role.findFirstOrThrow({ where: { name: "product_manager" } });
  await db.adminUser.create({ data: { email, name: "Gestor Produtos", passwordHash: await bcrypt.hash("SenhaGestor123", 10), roleId: role.id, active: true } });
  const s = sku("P");
  const prod = await db.product.create({ data: { name: `Produto ${s}`, slug: `p-${s.toLowerCase()}`, sku: s, priceCents: 9990, status: "PUBLISHED", variants: { create: [{ sku: `${s}-M`, size: "M", color: "Preto", stock: 7 }] } } });
  await login(page, email, "SenhaGestor123");
  await page.goto(`/admin/produtos/${prod.id}`);
  await expect(stockInput(page, "M", "Preto")).toHaveAttribute("readonly", "");
  await expect(page.getByText(/não altera estoque/)).toBeVisible();
  await page.getByLabel("Marca — opcional").fill("Só dados");
  await save(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  expect((await db.variant.findFirstOrThrow({ where: { productId: prod.id } })).stock).toBe(7);
});

test("responsivo: formulário e matriz de estoque no celular sem rolagem horizontal", async ({ page }) => {
  await login(page);
  for (const [w, h] of [[320, 640], [390, 800], [768, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await basics(page, sku(`R${w}`), "Tênis");
    for (const n of ["37", "38", "39"]) await pickSize(page, n);
    await pickColor(page, "Preto"); await pickColor(page, "Azul-marinho");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${w}px`).toBe(true);
    const input = stockInput(page, "38", "Azul-marinho");
    await input.scrollIntoViewIfNeeded();
    const b = (await input.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5); expect(b.height).toBeGreaterThanOrEqual(40);
    const save = (await page.getByRole("button", { name: "Cadastrar produto" }).boundingBox())!;
    expect(save.height).toBeGreaterThanOrEqual(40);
  }
});
