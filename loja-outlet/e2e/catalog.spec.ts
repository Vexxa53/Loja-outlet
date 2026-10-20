import { expect, test, type Page } from "@playwright/test";
import { clearLimits, ensureTestData, resetStarterCatalog } from "./limits";
import { makePng } from "./images";
import { pickColor, pickSize, saveAndWait, setStock } from "./variants";

test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);
test.describe.configure({ mode: "serial" });

const errors: string[] = [];
function watch(page: Page) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (400|401|403|404)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  // net::ERR_ABORTED = o navegador cancelou a requisição ao navegar (normal); falhas reais e respostas 5xx contam como erro
  page.on("requestfailed", (r) => { if (r.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
}

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#email").fill("admin@teste.local");
  await page.locator("#password").fill("SenhaTeste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.endsWith("/login"));
}

/** Rola a página inteira para disparar o carregamento tardio das imagens e confere se todas carregaram de verdade. */
async function allImagesLoaded(page: Page) {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForLoadState("networkidle");
  const broken = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("main img")].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
  expect(broken, `imagens quebradas: ${broken.join(", ")}`).toEqual([]);
  return page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("main img")].map((i) => i.currentSrc));
}

test("catálogo inicial: instalação pelo painel, vitrine, edição e persistência", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await resetStarterCatalog();
  watch(page);
  await login(page);

  // 1) instalar pelo botão do painel
  await page.goto("/admin/produtos");
  await expect(page.getByRole("heading", { name: "Catálogo inicial de demonstração" })).toBeVisible();
  await page.getByRole("button", { name: /Instalar catálogo inicial \(35 produtos\)/ }).click();
  await expect(page.getByText(/Pronto: 35 produto\(s\) criado\(s\)/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/foto\(s\) no armazenamento de imagens/)).toBeVisible();

  // 2) aparecem todos no painel
  await page.goto("/admin/produtos?q=OUT3K");
  await expect(page.locator("table tbody tr")).toHaveCount(35);
  await expect(page.locator("table .badge", { hasText: "Exemplo" })).toHaveCount(35);

  // 3) vitrine: totais por categoria
  const store = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(store);
  const counts: Record<string, number> = { camisas: 8, calcas: 8, tenis: 8, "blusas-e-jaquetas": 8, relogios: 3 };
  const srcs = new Set<string>();
  for (const [slug, n] of Object.entries(counts)) {
    await store.goto(`/produtos?categoria=${slug}`);
    await expect(store.getByText(`${n} produto(s) encontrado(s)`)).toBeVisible();
    for (const s of await allImagesLoaded(store)) srcs.add(s);
    await expect(store.locator('main a[href^="/produto/"]')).toHaveCount(n);
  }
  expect(srcs.size).toBe(35); // 35 imagens, todas diferentes e carregadas
  await store.goto("/produtos?q=OUT3K");
  await expect(store.getByText("35 produto(s) encontrado(s)")).toBeVisible();
  await expect(store.getByRole("link", { name: "3", exact: true })).toBeVisible(); // paginação
  // cartão: imagem, nome e preço
  const card = store.locator('main a[href^="/produto/"]').first();
  await expect(card.locator("img")).toBeVisible();
  await expect(card).toContainText(/R\$\s?\d/);

  // 4) pesquisa e filtro
  await store.goto("/produtos?q=jaqueta");
  await expect(store.getByText("Jaqueta Puffer Preta")).toBeVisible();
  await store.goto("/produtos?categoria=tenis&tamanho=42&disponivel=1");
  await expect(store.getByText("8 produto(s) encontrado(s)")).toBeVisible();

  // 5) página inicial: lançamentos, destaques e categorias (sem categorias vazias)
  await store.goto("/");
  await expect(store.getByRole("heading", { name: "Lançamentos" })).toBeVisible();
  await expect(store.getByRole("heading", { name: "Destaques" })).toBeVisible();
  await expect(store.locator('a[href^="/produtos?categoria="]').filter({ hasText: /Acessórios|Perfumes/ })).toHaveCount(0);
  await expect(store.getByRole("link", { name: "Relógios" }).first()).toBeVisible();
  await allImagesLoaded(store);

  // 6) página de produto com variações e estoque
  await store.goto("/produtos?q=Puffer");
  await store.getByText("Jaqueta Puffer Preta").first().click();
  await expect(store).toHaveURL(/\/produto\//);
  await expect(store.getByRole("heading", { name: "Jaqueta Puffer Preta" })).toBeVisible();
  await expect(store.getByText("R$ 399,90").first()).toBeVisible();
  await expect(store.getByRole("button", { name: "GG", exact: true })).toBeEnabled();
  const puffer = store.url();

  // 7) editar pelo painel: nome, preço, promoção e destaque refletem na loja
  await page.goto("/admin/produtos?q=OUT3K-JAQ-007");
  await page.getByRole("link", { name: "Jaqueta Puffer Preta" }).first().click();
  await page.getByLabel("Nome do produto").fill("Jaqueta Puffer Preta Editada");
  await page.getByLabel("Preço de venda (R$)").fill("450,00");
  await page.getByLabel(/Preço promocional/).fill("399,00");
  await page.getByLabel("Destaque na página inicial").uncheck();
  await saveAndWait(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  await store.goto(puffer);
  await expect(store.getByRole("heading", { name: "Jaqueta Puffer Preta Editada" })).toBeVisible();
  await expect(store.getByText("R$ 399,00").first()).toBeVisible();
  await expect(store.getByText("-11%")).toBeVisible();
  // categoria e tamanhos/estoque editáveis
  // calçado exige numeração: mudar a categoria para Tênis com tamanhos de roupa é barrado e nada muda
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "Tênis" });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Selecione pelo menos um tamanho para este calçado.").first()).toBeVisible();
  await store.goto("/produtos?categoria=tenis");
  await expect(store.getByText("8 produto(s) encontrado(s)")).toBeVisible();
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "Blusas e jaquetas" });
  await pickSize(page, "XG"); await pickColor(page, "Verde");
  await page.getByLabel("Estoque das linhas novas ainda vazias:").fill("0");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await setStock(page, "XG", "Verde", "3");
  await saveAndWait(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  await store.goto(puffer);
  await store.getByRole("button", { name: "Verde", exact: true }).click();
  await expect(store.getByRole("button", { name: "XG", exact: true })).toBeVisible();

  // 8) trocar a imagem por upload
  const before = await page.getByAltText("Foto 1").getAttribute("src");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Trocar" }).click();
  await (await chooser).setFiles({ name: "nova.png", mimeType: "image/png", buffer: makePng(600, 800, [40, 80, 160]) });
  await expect(page.getByText("Imagem substituída.")).toBeVisible();
  await page.reload();
  const after = await page.getByAltText("Foto 1").getAttribute("src");
  expect(after).not.toBe(before);
  await store.goto(puffer);
  await expect.poll(() => store.locator("main img").first().evaluate((i: HTMLImageElement) => i.currentSrc)).toContain(after!.split("/").pop()!);

  // 9) desativar → some da loja; excluir → some do painel
  await page.getByLabel("Situação na loja").selectOption("DRAFT");
  await saveAndWait(page);
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  expect((await store.goto(puffer))?.status()).toBe(404);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByText("Produto excluído.")).toBeVisible();
  await page.goto("/admin/produtos?q=OUT3K-JAQ-007");
  await expect(page.getByText("Nenhum produto encontrado.")).toBeVisible();

  // 10) completar o catálogo recria apenas o que faltou, sem duplicar
  await page.goto("/admin/produtos");
  await page.getByRole("button", { name: /Completar catálogo inicial/ }).click();
  await expect(page.getByText(/Pronto: 1 produto\(s\) criado\(s\)/)).toBeVisible({ timeout: 60_000 });
  await page.goto("/admin/produtos?q=OUT3K");
  await expect(page.locator("table tbody tr")).toHaveCount(35);

  // 11) persistência: sair, entrar e conferir
  await page.goto("/admin/produtos");
  await page.getByRole("button", { name: "Sair" }).click();
  await login(page);
  await page.goto("/admin/produtos?q=OUT3K");
  await expect(page.locator("table tbody tr")).toHaveCount(35);

  // 12) botões de lote: inativar todos e reativar
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Colocar todos como Inativos" }).click();
  await expect(page.getByText(/35 produto\(s\) do catálogo inicial atualizados/)).toBeVisible();
  await store.goto("/produtos?categoria=camisas");
  await expect(store.getByText("0 produto(s) encontrado(s)")).toBeVisible();
  await page.getByRole("button", { name: "Colocar todos como Ativos" }).click();
  await expect(page.getByText(/35 produto\(s\) do catálogo inicial atualizados/)).toBeVisible();
  await store.goto("/produtos?categoria=camisas");
  await expect(store.getByText("8 produto(s) encontrado(s)")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
  await store.close();
});
