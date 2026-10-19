import { clearLimits, ensureTestData } from "./limits";
import { expect, test } from "@playwright/test";

const stamp = Date.now();
const emailA = `a${stamp}@example.com`;
const emailB = `b${stamp}@example.com`;
const pass = "SenhaForte123";

test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);

test("loja: navegação, filtros, carrinho, checkout e conta", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Todos/ })).toBeVisible();
  await page.goto("/produtos?q=moletom");
  await expect(page.getByText("Moletom Básico com Capuz Taupe")).toBeVisible();
  await expect(page.getByText("Camiseta Oversized Branca")).toHaveCount(0);
  await page.goto("/produtos?promo=1&ordem=menor");
  await expect(page.getByText(/produto\(s\) encontrado/)).toBeVisible();

  await page.goto("/produto/moletom-basico-com-capuz-taupe");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar à sacola", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Adicionado à sacola");
  await page.getByRole("button", { name: "Continuar comprando" }).click();
  await page.goto("/carrinho");
  await expect(page.getByText("Moletom Básico com Capuz Taupe")).toBeVisible();
  await page.getByLabel("Cupom").fill("BEMVINDO10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Desconto")).toBeVisible();
  await page.getByLabel("CEP", { exact: true }).fill("01310-100");
  await page.getByRole("button", { name: "Frete" }).click();
  await expect(page.getByText(/Entrega padrão \(/)).toBeVisible();

  // cadastro
  await page.goto("/conta/cadastrar");
  await page.getByLabel("Nome completo").fill("Cliente A");
  await page.getByLabel("E-mail", { exact: true }).fill(emailA);
  await page.getByLabel(/Senha/).fill(pass);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/conta$/);

  // checkout em etapas (mantém os dados entre as etapas)
  await page.goto("/checkout?cep=01310-100");
  await page.getByLabel("Telefone (opcional)").fill("11999999999");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Entrega padrão|Frete/).first()).toBeVisible();
  await page.getByLabel("Rua", { exact: true }).fill("Av Paulista");
  await page.getByLabel("Número", { exact: true }).fill("1000");
  await page.getByLabel("Bairro", { exact: true }).fill("Bela Vista");
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("UF", { exact: true }).fill("SP");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Av Paulista, 1000")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(/\/pedido\/.+/);
  const orderUrl = page.url();
  await expect(page.getByRole("heading", { name: /Pedido #/ })).toBeVisible();
  await page.goto("/conta/pedidos");
  await expect(page.locator("table")).toContainText("#");

  // isolamento: cliente B não vê pedido de A
  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  await b.goto("/conta/cadastrar");
  await b.getByLabel("Nome completo").fill("Cliente B");
  await b.getByLabel("E-mail", { exact: true }).fill(emailB);
  await b.getByLabel(/Senha/).fill(pass);
  await b.getByRole("button", { name: "Cadastrar" }).click();
  await expect(b).toHaveURL(/\/conta$/);
  const res = await b.goto(orderUrl);
  expect(res?.status()).toBe(404);
  await ctx.close();

  // login errado
  const ctx2 = await browser.newContext();
  const c = await ctx2.newPage();
  await c.goto("/conta/entrar");
  await c.getByLabel("E-mail", { exact: true }).fill(emailA);
  await c.getByLabel("Senha").fill("errada12345");
  await c.getByRole("button", { name: "Entrar" }).click();
  await expect(c.locator("p[role=alert]")).toContainText("inválidos");
  await ctx2.close();
});

test("mobile: página inicial sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const p = await ctx.newPage();
  for (const path of ["/", "/produtos", "/produto/moletom-basico-com-capuz-taupe", "/carrinho"]) {
    await p.goto(path);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await p.goto("/");
  await p.screenshot({ path: "e2e-mobile.png", fullPage: true });
  await ctx.close();
});

test("admin: proteção de rotas, login, CRUD e permissões", async ({ page, request, browser }) => {
  // sem login
  const r = await page.goto("/admin/produtos");
  expect(page.url()).toContain("/admin/login");
  expect(r?.ok()).toBeTruthy();
  expect((await request.get("/api/admin/export")).status()).toBe(403);
  expect((await request.post("/api/webhooks/mercadopago", { data: { data: { id: "1" } } })).status()).toBeGreaterThanOrEqual(401);

  // senha errada
  await page.getByLabel("E-mail", { exact: true }).fill("admin@teste.local");
  await page.getByLabel("Senha").fill("errada12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("inválidas");

  await page.getByLabel("E-mail", { exact: true }).fill("admin@teste.local");
  await page.getByLabel("Senha").fill("SenhaTeste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // categoria
  await page.goto("/admin/categorias");
  const name = `Cat E2E ${stamp}`;
  const cf = page.locator("form", { has: page.locator("input[name=name]") }).first();
  await cf.getByLabel("Nome").fill(name);
  await cf.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByText("Categoria salva.")).toBeVisible();

  // produto com variação inicial e publicação (formulário novo, uma etapa)
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome do produto").fill(`Produto E2E ${stamp}`);
  await page.getByLabel("Código (SKU)").fill(`E2E-${stamp}`);
  await page.getByLabel("Preço de venda (R$)").fill("100,00");
  await page.getByLabel(/Preço promocional/).fill("80,00");
  await page.getByLabel("Situação na loja").selectOption("PUBLISHED");
  await page.getByLabel("Tamanho").first().fill("G");
  await page.getByLabel("Cor").first().fill("Azul");
  await page.getByLabel("Estoque").first().fill("4");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();

  // estoque: ajuste com motivo e saldo negativo bloqueado
  await page.goto(`/admin/estoque?q=E2E-${stamp}`);
  const row = page.locator("tr", { hasText: `E2E-${stamp}-G-AZUL` });
  await row.getByLabel("Quantidade").fill("10");
  await row.getByPlaceholder("Motivo").fill("teste e2e");
  await row.getByLabel("Tipo").selectOption("EXIT");
  await row.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("Saldo não pode ficar negativo.")).toBeVisible();

  // páginas administrativas carregam
  for (const p of ["/admin/pedidos", "/admin/clientes", "/admin/cupons", "/admin/banners", "/admin/config", "/admin/usuarios", "/admin/auditoria"]) {
    const rr = await page.goto(p);
    expect(rr?.status(), p).toBe(200);
  }
  const csv = await page.request.get("/api/admin/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Numero");

  // usuário estoquista: sem acesso a usuários/pedidos-write
  await page.goto("/admin/usuarios");
  await page.getByPlaceholder("", { exact: false }).first();
  const f = page.locator("form", { has: page.locator("input[name=password]") }).first();
  await f.getByLabel("Nome").fill("Estoquista");
  await f.getByLabel("E-mail", { exact: true }).fill(`est${stamp}@teste.local`);
  await f.getByLabel("Perfil").selectOption({ label: "Estoquista" });
  await f.getByLabel(/Senha inicial/).fill("SenhaEstoq123");
  await f.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText("Usuário salvo.")).toBeVisible();

  const ctx = await browser.newContext();
  const e = await ctx.newPage();
  await e.goto("/admin/login");
  await e.getByLabel("E-mail", { exact: true }).fill(`est${stamp}@teste.local`);
  await e.getByLabel("Senha").fill("SenhaEstoq123");
  await e.getByRole("button", { name: "Entrar" }).click();
  await e.waitForURL("**/admin");
  await expect(e.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  const denied = await e.goto("/admin/usuarios");
  void denied; await e.waitForURL(/\/admin\/sem-permissao/);
  expect((await e.goto("/admin/estoque"))?.status()).toBe(200);
  await ctx.close();
});
