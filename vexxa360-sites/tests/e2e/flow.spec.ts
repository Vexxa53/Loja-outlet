import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ANON, SERVICE, API, brInput, createUser, latestMail, psql, rest, signInToken, solidPng } from "./helpers";

const PW = "Senha-Forte-123";
const MASTER = "master@vexxa.test", OWNER_A = "dona-a@vexxa.test", OWNER_B = "dono-b@vexxa.test";
const tmp = path.resolve(__dirname, ".tmp");
mkdirSync(tmp, { recursive: true });
const img = (n: string, rgb: [number, number, number]) => { const f = path.join(tmp, n); writeFileSync(f, solidPng(120, 160, rgb)); return f; };

async function login(page: Page, email: string, password = PW, expectOk = true) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  if (expectOk) await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const logout = async (page: Page) => { await page.getByRole("button", { name: "Sair" }).first().click(); await expect(page).toHaveURL(/\/login/); };

let productId = "";
let orderId = "";
let tenantA = "";

test.describe.serial("Vexxa360 Sites — fluxo comercial ponta a ponta", () => {
  test.beforeAll(async () => {
    await createUser(MASTER, PW); await createUser(OWNER_A, PW); await createUser(OWNER_B, PW);
    // Bootstrap documentado: o primeiro admin da plataforma é inserido por SQL (nunca pela interface/API pública).
    psql(`insert into platform_admins (user_id) select id from auth.users where email='${MASTER}'`);
  });

  test("acesso sem login é barrado e login inválido mostra erro claro", async ({ page, request }) => {
    for (const p of ["/admin", "/admin/produtos", "/admin/pedidos", "/master"]) {
      const r = await request.get(p, { maxRedirects: 0 });
      expect(r.status(), p).toBe(307);
      expect(r.headers()["location"]).toContain("/login");
    }
    await login(page, OWNER_A, "senha-errada", false);
    await expect(alerts(page)).toContainText("E-mail ou senha incorretos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("lojista não acessa o painel master", async ({ page }) => {
    await login(page, OWNER_A);
    await page.goto("/master");
    await expect(page).not.toHaveURL(/\/master$/);
  });

  test("master cria duas lojas e vincula os lojistas", async ({ page }) => {
    await login(page, MASTER);
    await page.goto("/master");
    for (const [name, slug, email] of [["Loja Teste A", "loja-a", OWNER_A], ["Loja Teste B", "loja-b", OWNER_B]]) {
      await page.getByLabel("Nome da loja").fill(name);
      await page.getByLabel("Identificador (URL)").fill(slug);
      await page.getByLabel("E-mail do lojista").fill(email);
      await page.getByRole("button", { name: "Criar loja" }).click();
      await expect(page.getByText(`Loja criada e vinculada a ${email}`).first()).toBeVisible();
    }
    await expect(page.getByText("/loja/loja-a").first()).toBeVisible();
    await expect(page.getByText("/loja/loja-b").first()).toBeVisible();
    // identificador duplicado é recusado
    await page.getByLabel("Nome da loja").fill("Outra");
    await page.getByLabel("Identificador (URL)").fill("loja-a");
    await page.getByLabel("E-mail do lojista").fill(OWNER_B);
    await page.getByRole("button", { name: "Criar loja" }).click();
    await expect(page.getByText("Este identificador já está em uso.").first()).toBeVisible();
    tenantA = psql("select id from tenants where slug='loja-a'");
    expect(tenantA).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("loja nova (não publicada) não aparece para o público", async ({ request }) => {
    expect((await request.get("/loja/loja-a")).status()).toBe(404);
  });

  test("lojista A: painel vazio, configurações, personalização e categoria", async ({ page }) => {
    await login(page, OWNER_A);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Sua loja ainda não tem produtos").first()).toBeVisible();
    await expect(page.getByText("oculta").first()).toBeVisible();

    await page.goto("/admin/configuracoes");
    await page.getByLabel("WhatsApp da loja").fill("(11) 99999-0001");
    await page.getByLabel("E-mail de contato").fill("contato@lojaa.test");
    await page.getByLabel("Horário de atendimento").fill("Seg a sáb, 9h às 18h");
    await page.getByLabel("Informações de entrega").fill("Entregamos em toda a cidade.");
    await page.getByLabel("Privacidade (link https)").fill("http://inseguro.test");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("começando com https://").first()).toBeVisible();     // validação de URL
    await page.getByLabel("Privacidade (link https)").fill("https://lojaa.test/privacidade");
    await page.getByLabel(/Loja publicada/).check();
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("A loja está publicada").first()).toBeVisible();

    await page.goto("/admin/personalizacao");
    await page.getByLabel("Nome comercial").fill("Atelier Aurora");
    await page.getByLabel("Texto de apresentação").fill("Moda feminina com curadoria e carinho.");
    await page.locator("#primaryColor").fill("#2a3a4a");
    await page.locator("#secondaryColor").fill("#c0392b");
    await page.getByLabel("Instagram").fill("@atelier.aurora");
    await page.locator("#logo").setInputFiles(img("logo.png", [40, 60, 80]));
    await page.getByRole("button", { name: "Salvar personalização" }).click();
    await expect(page.getByText("Personalização salva").first()).toBeVisible();

    // (cores inválidas são cobertas nos testes unitários do schema e no servidor)

    await page.goto("/admin/categorias");
    await page.getByLabel("Nome", { exact: true }).fill("Camisetas");
    await page.getByRole("button", { name: "Criar categoria" }).click();
    await expect(page.getByText("Categoria criada.").first()).toBeVisible();
    await page.getByLabel("Nome", { exact: true }).fill("Camisetas");
    await page.getByRole("button", { name: "Criar categoria" }).click();
    await expect(page.getByRole("cell", { name: "camisetas-" }).first()).toBeVisible(); // slug duplicado ganhou sufixo
    await page.getByLabel("Nome", { exact: true }).fill("Vestidos");
    await page.getByRole("button", { name: "Criar categoria" }).click();
    await expect(page.getByRole("cell", { name: "Vestidos", exact: true })).toBeVisible();
  });

  test("lojista A: cadastra produto com fotos, variações e estoque; valida erros; publica", async ({ page }) => {
    await login(page, OWNER_A);
    await page.goto("/admin/produtos/novo");

    // validações do servidor
    await page.getByLabel("Nome do produto").fill("Camiseta Linho");
    await page.getByLabel("Preço de venda (R$)").fill("-10");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(alerts(page).first()).toContainText("Preço de venda inválido");
    await page.getByLabel("Preço de venda (R$)").fill("149,90");
    await page.getByLabel("Preço promocional (R$)").fill("200,00");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(alerts(page).first()).toContainText("menor que o preço de venda");
    await page.getByLabel("Preço promocional (R$)").fill("");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(alerts(page).first()).toContainText("ao menos uma variação ativa");

    await page.getByLabel("Descrição", { exact: true }).fill("Camiseta de linho leve, ideal para o verão.");
    await page.getByLabel("Categoria").selectOption({ label: "Camisetas" });
    await page.getByLabel("SKU (opcional)").fill("CAM-LINHO");
    await page.getByLabel("Custo de aquisição (R$)").fill("45,00");
    await page.getByLabel("Composição do tecido").fill("100% linho");
    await page.getByLabel("Tags (separe por vírgula)").fill("verão, linho");
    await page.getByLabel("Tamanhos (separe por vírgula)").fill("P, M");
    await page.getByLabel("Cores (separe por vírgula)").fill("Preta, Branca");
    await page.getByRole("button", { name: "Gerar combinações" }).click();
    const stocks = page.getByLabel("Estoque", { exact: true });
    await expect(stocks).toHaveCount(4);
    // ordem das linhas: P/Preta, P/Branca, M/Preta, M/Branca
    await stocks.nth(0).fill("10"); await stocks.nth(1).fill("0"); await stocks.nth(2).fill("2"); await stocks.nth(3).fill("5");
    await page.locator('input[type="file"]').setInputFiles([img("foto1.png", [200, 120, 90]), img("foto2.png", [90, 120, 200])]);
    await expect(page.getByAltText("Nova foto (ainda não enviada)")).toHaveCount(2);
    await page.getByLabel("Destacar na página inicial").check();
    await page.getByRole("button", { name: "Publicar" }).click();

    await expect(page).toHaveURL(/\/admin\/produtos\?ok=/);
    await expect(page.getByText("Produto publicado.").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Camiseta Linho" })).toBeVisible();
    productId = psql("select id from products where name='Camiseta Linho'");
    expect(psql(`select count(*) from product_images where product_id='${productId}'`)).toBe("2");
    expect(psql(`select count(*) from product_variants where product_id='${productId}'`)).toBe("4");
    expect(psql(`select cost_price from product_costs where product_id='${productId}'`)).toBe("45.00");
    // arquivos realmente no Storage (persistência fora do disco da Vercel)
    expect(psql("select count(*) from storage.objects where bucket_id='store-media' and name like '" + tenantA + "/products/%'")).toBe("2");
  });

  test("persistência: recarregar e reabrir mostra os mesmos dados; edição funciona", async ({ page }) => {
    await login(page, OWNER_A);
    await page.goto(`/admin/produtos/${productId}`);
    await page.reload();
    await expect(page.getByLabel("Nome do produto")).toHaveValue("Camiseta Linho");
    await expect(page.getByLabel("Preço de venda (R$)")).toHaveValue("149,90");
    await expect(page.getByLabel("Custo de aquisição (R$)")).toHaveValue("45,00");
    await expect(page.getByLabel("Estoque", { exact: true })).toHaveCount(4);
    await expect(page.locator('img[alt="Camiseta Linho"]')).toHaveCount(2);

    await page.getByLabel("Preço promocional (R$)").fill("129,90");
    await expect(page.getByText("De R$").first()).toBeVisible();
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Produto publicado.").first()).toBeVisible();
    expect(psql(`select promotional_price from products where id='${productId}'`)).toBe("129.90");
    // ajuste de estoque pelo formulário gera movimentação
    await page.goto(`/admin/produtos/${productId}`);
    await page.getByLabel("Estoque", { exact: true }).nth(1).fill("3");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Produto publicado.").first()).toBeVisible();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='P' and color='Branca'`)).toBe("3");
    expect(psql(`select count(*) from inventory_movements where reason like 'Ajuste no cadastro%'`)).toBe("1");
  });
});
