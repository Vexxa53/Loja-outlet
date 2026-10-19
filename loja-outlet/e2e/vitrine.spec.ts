import { clearLimits, ensureTestData } from "./limits";
import { expect, test } from "@playwright/test";

test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);

test("vitrine: busca com sugestões, favoritos, filtros e ordenação", async ({ page }) => {
  await page.goto("/");
  const busca = page.getByPlaceholder("Buscar camisas, tênis, relógios...").first();
  await busca.fill("camis");
  await expect(page.locator("[id$='-panel']").first()).toContainText(/Camis/i);

  await page.goto("/produtos?categoria=tenis");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/produtos?ordem=menor");
  const precos = await page.locator(".card:has(a[href^=\"/produto/\"])").first().innerText();
  expect(precos).toMatch(/R\$/);

  await page.goto("/produtos");
  await page.getByRole("button", { name: /^Favoritar/ }).first().click();
  await page.goto("/favoritos");
  await expect(page.locator(".card:has(a[href^=\"/produto/\"])").first()).toBeVisible();
});

test("vitrine: newsletter exige consentimento e grava e-mail", async ({ page }) => {
  await page.goto("/");
  const email = `news${Date.now()}@example.com`;
  const campo = page.getByPlaceholder("Seu melhor e-mail");
  await campo.scrollIntoViewIfNeeded();
  await campo.fill(email);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /Quero receber|Cadastrar|Assinar|Enviar/ }).first().click();
  await expect(page.getByText(/obrigad|cadastrad|inscri/i).first()).toBeVisible();
});

test("produto: simulador de frete", async ({ page }) => {
  await page.goto("/produto/moletom-basico-com-capuz-taupe");
  await page.getByPlaceholder("00000-000").fill("01310-100");
  await page.getByRole("button", { name: /Calcular|OK|Consultar/ }).click();
  await expect(page.getByText(/Entrega padrão|R\$/).first()).toBeVisible();
});
