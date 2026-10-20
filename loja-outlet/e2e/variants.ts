import { expect, type Page } from "@playwright/test";

/** Ajudantes do formulário de produto (tamanhos, cores e estoque por combinação). */
export async function pickSize(page: Page, size: string) {
  const chip = page.getByRole("button", { name: size, exact: true });
  if (await chip.count()) { await chip.first().click(); return; }
  await page.getByLabel("Adicionar tamanho personalizado").fill(size);
  await page.getByRole("button", { name: "Adicionar tamanho" }).click();
}
export async function pickColor(page: Page, color: string) {
  const chip = page.getByRole("button", { name: color, exact: true });
  if (await chip.count()) { await chip.first().click(); return; }
  await page.getByLabel("Adicionar cor personalizada").fill(color);
  await page.getByRole("button", { name: "Adicionar cor" }).click();
}
export const stockInput = (page: Page, size: string, color: string) => page.getByLabel(`Estoque ${size} ${color}`, { exact: true });
export async function setStock(page: Page, size: string, color: string, value: string) { await stockInput(page, size, color).fill(value); }
export const variantCount = (page: Page) => page.getByTestId("variant-count");
export async function expectCount(page: Page, n: number) { await expect(variantCount(page).locator("strong").first()).toHaveText(String(n)); }

/** Clica em salvar e espera a resposta do servidor (a mensagem "Alterações salvas" pode já estar na tela de um salvamento anterior). */
export async function saveAndWait(page: Page, name: RegExp | string = /Cadastrar produto|Salvar alterações/) {
  const resp = page.waitForResponse((r) => r.request().method() === "POST" && r.status() === 200);
  await page.getByRole("button", { name }).click();
  await resp;
}
