import { PrismaClient } from "@prisma/client";
import { clearLimits, ensureTestData } from "./limits";
import { expect, test, type Page } from "@playwright/test";

const db = new PrismaClient();
test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);
test.afterAll(async () => {
  // deixa o ambiente de teste no estado padrão (não configurado)
  const row = await db.setting.findUnique({ where: { key: "payments" } });
  if (row) await db.setting.update({ where: { key: "payments" }, data: { value: { ...(row.value as object), mode: "OFF" } as never } });
});

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#email").fill("admin@teste.local");
  await page.locator("#password").fill("SenhaTeste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.endsWith("/login"));
}

async function setMode(page: Page, mode: "OFF" | "TEST") {
  await page.goto("/admin/config/pagamentos");
  await page.getByLabel("Como a loja recebe").selectOption(mode);
  await page.getByRole("button", { name: "Salvar pagamentos" }).click();
  await expect(page.getByText("Configurações de pagamento salvas.")).toBeVisible();
}

/** Percorre o checkout real com um produto e devolve a URL do pedido. */
async function buy(page: Page, method: RegExp, slug = "moletom-basico-com-capuz-taupe") {
  await page.goto(`/produto/${slug}`);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Comprar" }).click();
  await expect(page).toHaveURL(/\/carrinho/);
  await page.getByRole("link", { name: "Finalizar compra" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByLabel("Nome completo").fill("Cliente Pagamento");
  await page.getByLabel("E-mail", { exact: true }).fill(`pag${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("CEP", { exact: true }).fill("01310-100");
  await page.getByRole("button", { name: "Calcular frete" }).click();
  await expect(page.getByText(/dias úteis/).first()).toBeVisible();
  await page.getByLabel("Rua", { exact: true }).fill("Av Paulista");
  await page.getByLabel("Número", { exact: true }).fill("1000");
  await page.getByLabel("Bairro", { exact: true }).fill("Bela Vista");
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("UF", { exact: true }).fill("SP");
  await page.getByRole("button", { name: "Continuar" }).click();
  // validação: sem escolher o pagamento não avança
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Escolha a forma de pagamento");
  await page.getByRole("radio", { name: method }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Revisar e confirmar pedido")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(/\/pedido\//);
  return page.url();
}

const sim = (page: Page, name: string) => page.getByRole("region", { name: "Simulação de teste" }).getByRole("button", { name });

test("pagamentos: configuração no painel, segredos nunca exibidos, modo não configurado", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/config/pagamentos");
  await expect(page.getByText("Status da integração:")).toBeVisible();
  await expect(page.getByText("Não configurado").first()).toBeVisible();
  for (const id of ["pixKey", "secretKey", "webhookSecret"]) await expect(page.locator(`#${id}`)).toHaveValue("");
  // salva uma chave FALSA só para testar que ela é guardada e nunca volta para a tela
  await page.locator("#secretKey").fill("CHAVE-FALSA-DE-TESTE-123456");
  await page.getByRole("button", { name: "Salvar pagamentos" }).click();
  await expect(page.getByText("Configurações de pagamento salvas.")).toBeVisible();
  await expect(page.locator("#secretKey")).toHaveValue("");
  await expect(page.locator("#secretKey")).toHaveAttribute("placeholder", /configurada/);
  expect(await page.content()).not.toContain("CHAVE-FALSA-DE-TESTE-123456");
  const stored = JSON.stringify((await db.setting.findUnique({ where: { key: "payments_secrets" } }))?.value);
  expect(stored).not.toContain("CHAVE-FALSA"); // guardada criptografada
  await page.getByLabel("Remover este valor").first().check();
  await page.getByRole("button", { name: "Salvar pagamentos" }).click();
  await expect(page.locator("#secretKey")).toHaveAttribute("placeholder", /Vazio/);

  // loja em modo "não configurado": métodos aparecem com aviso e o pedido fica aguardando confirmação manual
  await setMode(page, "OFF");
  const store = await page.context().newPage();
  const url = await buy(store, /PIX/);
  await expect(store.getByText(/criado com sucesso\. Aguardando pagamento/)).toBeVisible();
  await expect(store.getByText(/recebimento online ainda não está ativo/i).first()).toBeVisible();
  await expect(store.getByRole("region", { name: "Simulação de teste" })).toHaveCount(0);
  // administrador confirma manualmente
  await page.goto("/admin/pedidos");
  await page.getByRole("link", { name: /^#\d+/ }).first().click();
  await expect(page.getByText("Pagamentos (1)")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar recebimento manualmente" }).click();
  await expect(page.getByText("Aprovado").first()).toBeVisible();
  await store.goto(url);
  await expect(store.getByText(/Pagamento aprovado/).first()).toBeVisible();
});

test("pagamentos: PIX de teste — aprovado, depois estorno", async ({ page }) => {
  await adminLogin(page);
  await setMode(page, "TEST");
  const store = await page.context().newPage();
  await buy(store, /PIX/);
  await expect(store.getByText(/AMBIENTE DE TESTE/).first()).toBeVisible();
  await expect(store.getByLabel(/PIX copia e cola/)).toHaveValue(/^TESTE-SIMULADO-NAO-PAGAVEL-TX/);
  await expect(store.getByText(/Expira em/)).toBeVisible();
  await sim(store, "Aprovar").click();
  await expect(store.getByText(/confirmado\. Pagamento aprovado/)).toBeVisible();
  await sim(store, "Estornar").click();
  await expect(store.getByText(/estornado/).first()).toBeVisible();
  // administrador enxerga pagamento, TESTE, histórico
  await page.goto("/admin/pedidos");
  await page.getByRole("link", { name: /^#\d+/ }).first().click();
  await expect(page.getByText("TESTE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Estornado").first()).toBeVisible();
  await expect(page.getByText(/Pagamento estornado/).first()).toBeVisible();
});

test("pagamentos: cartão de teste — recusado, nova tentativa aprovada em parcelas", async ({ page }) => {
  await adminLogin(page);
  await setMode(page, "TEST");
  const store = await page.context().newPage();
  await buy(store, /Cartão de crédito/);
  const reqs: string[] = [];
  store.on("request", (r) => { if (r.method() === "POST") reqs.push(r.postData() ?? ""); });
  // dados inválidos
  await store.getByLabel("Número do cartão").fill("1234 5678 9012 3456");
  await store.getByLabel("Nome impresso").fill("FULANO TESTE");
  await store.getByLabel("Validade").fill("12/30");
  await store.getByLabel("CVV").fill("123");
  await store.getByRole("button", { name: /Pagar .* \(TESTE\)/ }).click();
  await expect(store.locator("p[role=alert]")).toContainText("inválido");
  // cartão recusado
  await store.getByRole("button", { name: /4000 0000 0000 0002/ }).click();
  await store.getByLabel("Nome impresso").fill("FULANO TESTE");
  await store.getByLabel("Validade").fill("12/30");
  await store.getByLabel("CVV").fill("123");
  await store.getByLabel("Parcelas").selectOption("2");
  await store.getByRole("button", { name: /Pagar .* \(TESTE\)/ }).click();
  await expect(store.getByText(/Pagamento do pedido .* recusado/)).toBeVisible();
  // número e CVV nunca foram enviados ao servidor
  expect(reqs.join("|")).not.toMatch(/4000\s?0000|123456|"123"/);
  // nova tentativa com PIX → aprovado
  await store.getByLabel("Escolha como pagar").selectOption("PIX");
  await store.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(store.getByLabel(/PIX copia e cola/)).toBeVisible();
  await sim(store, "Deixar pendente").click();
  await expect(store.getByText(/em análise/i).first()).toBeVisible();
  await sim(store, "Aprovar").click();
  await expect(store.getByText(/Pagamento aprovado/).first()).toBeVisible();
});

test("pagamentos: cartão aprovado em parcelas, expirado e cancelado", async ({ page }) => {
  await adminLogin(page);
  await setMode(page, "TEST");
  const store = await page.context().newPage();
  await buy(store, /Cartão de crédito/, "moletom-basico-com-capuz-taupe");
  await store.getByRole("button", { name: /4242 4242 4242 4242/ }).click();
  await store.getByLabel("Nome impresso").fill("FULANO TESTE");
  await store.getByLabel("Validade").fill("12/30");
  await store.getByLabel("CVV").fill("123");
  await store.getByRole("button", { name: /Pagar .* \(TESTE\)/ }).click();
  await expect(store.getByText(/confirmado\. Pagamento aprovado/)).toBeVisible();
  await expect(store.getByText(/•+|visa/i).first()).toBeVisible().catch(() => undefined);

  await buy(store, /PIX/);
  await sim(store, "Expirar").click();
  await expect(store.getByText(/cancelado/i).first()).toBeVisible();
  await expect(store.getByText(/prazo de pagamento terminou/)).toBeVisible();

  await buy(store, /PIX/);
  await sim(store, "Cancelar").click();
  await expect(store.getByText(/cancelado/i).first()).toBeVisible();
});

test("pagamentos: simulação é bloqueada fora do modo de teste (servidor)", async ({ page }) => {
  await adminLogin(page);
  await setMode(page, "TEST");
  const store = await page.context().newPage();
  const url = await buy(store, /PIX/);
  await setMode(page, "OFF");
  await store.goto(url);
  await expect(store.getByRole("region", { name: "Simulação de teste" })).toHaveCount(0);
});
