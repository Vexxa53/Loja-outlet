import { clearLimits, ensureTestData } from "./limits";
import { expect, test } from "@playwright/test";

test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);

const PECAS = [
  { slug: "moletom-basico-com-capuz-taupe", name: "Moletom Básico com Capuz Taupe" },
  { slug: null as string | null, name: "Calça", categoria: "calcas" },
  { slug: null as string | null, name: "Tênis", categoria: "tenis" },
];

test("compra: clique na peça, seleção obrigatória, comprar, carrinho, quantidade, persistência e checkout", async ({ page }) => {
  const nomes: string[] = [];

  for (const [i, peca] of PECAS.entries()) {
    // 1) clicar na peça a partir da listagem
    await page.goto(peca.categoria ? `/produtos?categoria=${peca.categoria}` : `/produtos?q=moletom`);
    const card = page.locator(".card:has(a[href^=\"/produto/\"])").first();
    const nome = (await card.locator("h3").first().innerText()).trim();
    nomes.push(nome);
    await card.locator("a[href^=\"/produto/\"]").first().click();
    await expect(page).toHaveURL(/\/produto\//);
    await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();

    // 2) sem selecionar tamanho: mensagem clara e nada é adicionado
    await page.getByRole("button", { name: "Comprar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Selecione/ })).toBeVisible();
    await expect(page).toHaveURL(/\/produto\//);

    // 3) seleciona cor (se houver várias) e tamanho disponível
    const cores = page.getByRole("button", { pressed: false }).filter({ has: page.locator("span.rounded-full") });
    if (await cores.count() > 1) await cores.first().click();
    const tamanhos = page.locator("button:not([disabled])[aria-pressed]").filter({ hasNotText: /^$/ });
    const sizeBtns = page.getByRole("button", { pressed: false }).filter({ hasText: /^(PP|P|M|G|GG|XG|\d{2})$/ });
    await sizeBtns.nth(i % Math.max(1, await sizeBtns.count())).click();
    void tamanhos;

    // 4) Comprar → vai sozinho ao carrinho
    await page.getByRole("button", { name: "Comprar" }).click();
    await expect(page).toHaveURL(/\/carrinho/);
    await expect(page.getByRole("link", { name: nome }).first()).toBeVisible();
  }

  // carrinho com 3 itens distintos
  await page.goto("/carrinho");
  await expect(page.locator("ul.space-y-3 > li")).toHaveCount(3);
  await expect(page.getByRole("link", { name: /Continuar comprando/ })).toBeVisible();

  // aumentar, diminuir e remover
  const li = page.locator("ul.space-y-3 > li").first();
  await li.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(li.getByRole("group").locator("span")).toHaveText("2");
  await li.getByRole("button", { name: "Diminuir quantidade" }).click();
  await expect(li.getByRole("group").locator("span")).toHaveText("1");
  await page.locator("ul.space-y-3 > li").nth(2).getByRole("button", { name: "Remover" }).click();
  await expect(page.locator("ul.space-y-3 > li")).toHaveCount(2);

  // persistência: navegar, recarregar, voltar
  await page.goto("/");
  await page.reload();
  await expect(page.getByRole("link", { name: /Sacola, 2 itens/ })).toBeVisible();
  await page.goto("/carrinho");
  await expect(page.locator("ul.space-y-3 > li")).toHaveCount(2);

  // finalizar → checkout existente com os itens
  await page.getByRole("link", { name: "Finalizar compra" }).click();
  await expect(page).toHaveURL(/\/(checkout|conta\/entrar)/);
});
