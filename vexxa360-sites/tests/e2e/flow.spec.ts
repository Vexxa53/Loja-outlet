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

  // ------------------------------------------------------------------ promoções e banner
  test("promoções: no ar, agendada e expirada; preço calculado no servidor", async ({ page }) => {
    await login(page, OWNER_A);
    await page.goto("/admin/promocoes");
    const fill = async (name: string, type: string, value: string, startMs: number, endMs: number) => {
      await page.getByLabel("Nome da campanha").fill(name);
      await page.getByLabel("Produto", { exact: true }).selectOption(productId);
      await page.getByLabel("Tipo de desconto").selectOption(type);
      await page.getByLabel("Valor", { exact: true }).fill(value);
      await page.getByLabel(/Início/).fill(brInput(startMs));
      await page.getByLabel(/Encerramento/).fill(brInput(endMs));
      await page.getByRole("button", { name: "Criar campanha" }).click();
      await expect(page.getByRole("button", { name: /Criar campanha|Criando/ })).toBeEnabled();   // espera o envio terminar
    };
    const H = 3600_000;
    // validações
    await fill("Inválida", "percent", "95", -H, H);
    await expect(page.getByText("máximo: 90%").first()).toBeVisible();
    await fill("Inválida", "percent", "10", H, -H);
    await expect(page.getByText("depois do início").first()).toBeVisible();
    await fill("Inválida", "percent", "-5", -H, H);
    await expect(page.getByText(/inválido|maior que zero/).first()).toBeVisible();

    await fill("Futura", "fixed_price", "50,00", 24 * H, 48 * H);
    await expect(page.getByText("Campanha criada").first()).toBeVisible();
    await fill("Expirada", "amount_off", "100,00", -48 * H, -24 * H);
    await expect(page.getByText("Campanha criada").first()).toBeVisible();
    // futura e expirada não alteram o preço (promocional do produto = 129,90)
    expect(psql(`select effective_price('${productId}')`)).toBe("129.90");
    await fill("Liquida", "percent", "20", -H, 24 * H);
    await expect(page.getByText("Campanha criada").first()).toBeVisible();
    expect(psql(`select effective_price('${productId}')`)).toBe("119.92");   // 149,90 − 20% (menor que 129,90)
    await expect(page.getByText("No ar agora")).toBeVisible();
    await expect(page.getByText("Agendada")).toBeVisible();
    await expect(page.getByText("Encerrada")).toBeVisible();
  });

  test("banner: cria com imagem e exige imagem", async ({ page }) => {
    await login(page, OWNER_A);
    await page.goto("/admin/banners");
    await page.getByLabel("Título", { exact: true }).fill("Coleção Verão");
    await page.getByRole("button", { name: "Criar banner" }).click();
    expect(await page.locator("#image").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);   // imagem obrigatória
    await page.locator("#image").setInputFiles(img("banner.png", [220, 180, 140]));
    await page.getByLabel("Subtítulo").fill("Até 20% off");
    await page.getByLabel("Texto do botão").fill("Ver ofertas");
    await page.getByLabel("Destino do botão").fill("//evil.example");
    await page.getByRole("button", { name: "Criar banner" }).click();
    await expect(page.getByText(/Destino: use um caminho/).first()).toBeVisible();
    await page.getByLabel("Destino do botão").fill("/loja/loja-a/produtos?promocao=1");
    await page.getByRole("button", { name: "Criar banner" }).click();
    await expect(page.getByText("Banner criado.").first()).toBeVisible();
    expect(psql("select count(*) from banners")).toBe("1");
  });

  // ------------------------------------------------------------------ vitrine pública
  test("vitrine pública: identidade, banner, categorias, produto com desconto, rodapé", async ({ page }) => {
    await page.goto("/loja/loja-a");
    await expect(page.getByRole("heading", { name: "Coleção Verão" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver ofertas" })).toBeVisible();
    await expect(page.locator('header img[alt="Atelier Aurora"]')).toBeVisible();       // logotipo
    await expect(page.getByRole("link", { name: "Camisetas", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Camiseta Linho/ }).first()).toBeVisible();
    await expect(page.getByText("-20%").first()).toBeVisible();
    await expect(page.getByText("R$ 119,92").first()).toBeVisible();
    await expect(page.locator("footer").getByText("@atelier.aurora")).toBeVisible();
    await expect(page.locator("footer").getByText("Seg a sáb, 9h às 18h")).toBeVisible();
    await expect(page.locator('footer a[href="https://lojaa.test/privacidade"]')).toBeVisible();
    await expect(page.locator('a[href^="https://wa.me/5511999990001"]').first()).toBeVisible();
    // cor do lojista aplicada via variável CSS
    const brand = await page.locator("div.flex.min-h-screen").first().evaluate((el) => (el as HTMLElement).style.getPropertyValue("--brand"));
    expect(brand).toBe("#2a3a4a");
    // custo de aquisição nunca vai para o HTML público
    const html = await page.content();
    expect(html).not.toContain("45,00"); expect(html).not.toContain("cost_price"); expect(html).not.toContain("45.00");
  });

  test("catálogo: busca, categoria, tamanho, cor, preço, disponibilidade, promoção e ordenação", async ({ page }) => {
    const ok = async (qs: string, visible: boolean) => {
      await page.goto(`/loja/loja-a/produtos${qs}`);
      const card = page.getByRole("link", { name: /Camiseta Linho/ });
      if (visible) await expect(card.first(), qs).toBeVisible(); else { await expect(page.getByRole("main").getByText("Nenhum produto encontrado")).toBeVisible(); }
    };
    await ok("", true);
    await ok("?q=linho", true);
    await ok("?q=xyz", false);
    await ok("?tamanho=M", true);
    await ok("?tamanho=GG", false);
    await ok("?cor=Preta", true);
    await ok("?cor=Verde", false);
    await ok("?min=100&max=130", true);
    await ok("?min=200", false);
    await ok("?disponivel=1", true);
    await ok("?promocao=1", true);
    await ok("?ordem=menor-preco", true);
    await ok("?q=%25_%27;--", false);                       // curingas e aspas não quebram a consulta
    const cat = psql("select id from categories where name='Camisetas'");
    await ok(`?categoria=${cat}`, true);
    await ok(`?categoria=${psql("select id from categories where name='Vestidos'")}`, false);
    await ok("?categoria=nao-e-uuid", true);                // valor inválido é ignorado
    await page.goto("/loja/loja-a/produtos?pagina=999");     // página fora do intervalo não quebra
    await expect(page.getByRole("main").getByText("Nenhum produto encontrado")).toBeVisible();
  });

  test("paginação (13 produtos): 12 por página e link para a próxima", async ({ page }) => {
    const B = psql("select id from tenants where slug='loja-b'");
    psql(`update store_settings set published=true, whatsapp='5511999990002' where tenant_id='${B}'`);
    psql(`insert into products (tenant_id,name,slug,regular_price,status) select '${B}','Peça '||g,'peca-'||g,10+g,'published' from generate_series(1,13) g`);
    psql(`insert into product_variants (tenant_id,product_id,size,stock_quantity) select tenant_id,id,'U',5 from products where tenant_id='${B}'`);
    await page.goto("/loja/loja-b/produtos");
    await expect(page.locator('a[href^="/loja/loja-b/produto/"]')).toHaveCount(12);
    await page.getByRole("link", { name: "Próxima" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.locator('a[href^="/loja/loja-b/produto/"]')).toHaveCount(1);
    psql(`delete from products where tenant_id='${B}'`);
    psql(`update store_settings set published=false where tenant_id='${B}'`);
  });
});
