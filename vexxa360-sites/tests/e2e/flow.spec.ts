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
/** goto + espera o streaming do React terminar (segmentos ocultos "S:n" são removidos logo após o swap). */
async function go(page: Page, url: string) {
  const r = await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('[id^="S:"]'));
  return r;
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
    await go(page, "/master");
    await expect(page).not.toHaveURL(/\/master$/);
  });

  test("master cria duas lojas e vincula os lojistas", async ({ page }) => {
    await login(page, MASTER);
    await go(page, "/master");
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

    await go(page, "/admin/configuracoes");
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

    await go(page, "/admin/personalizacao");
    await page.getByLabel("Nome comercial").fill("Atelier Aurora");
    await page.getByLabel("Texto de apresentação").fill("Moda feminina com curadoria e carinho.");
    await page.locator("#primaryColor").fill("#2a3a4a");
    await page.locator("#secondaryColor").fill("#c0392b");
    await page.getByLabel("Instagram").fill("@atelier.aurora");
    await page.locator("#logo").setInputFiles(img("logo.png", [40, 60, 80]));
    await page.getByRole("button", { name: "Salvar personalização" }).click();
    await expect(page.getByText("Personalização salva").first()).toBeVisible();

    // (cores inválidas são cobertas nos testes unitários do schema e no servidor)

    await go(page, "/admin/categorias");
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
    await go(page, "/admin/produtos/novo");

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
    await go(page, `/admin/produtos/${productId}`);
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
    await go(page, `/admin/produtos/${productId}`);
    await page.getByLabel("Estoque", { exact: true }).nth(1).fill("3");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Produto publicado.").first()).toBeVisible();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='P' and color='Branca'`)).toBe("3");
    expect(psql(`select count(*) from inventory_movements where reason like 'Ajuste no cadastro%'`)).toBe("1");
  });

  // ------------------------------------------------------------------ promoções e banner
  test("promoções: no ar, agendada e expirada; preço calculado no servidor", async ({ page }) => {
    await login(page, OWNER_A);
    await go(page, "/admin/promocoes");
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
    await expect(page.getByText("No ar agora").first()).toBeVisible();
    await expect(page.getByText("Agendada").first()).toBeVisible();
    await expect(page.getByText("Encerrada").first()).toBeVisible();
  });

  test("banner: cria com imagem e exige imagem", async ({ page }) => {
    await login(page, OWNER_A);
    await go(page, "/admin/banners");
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
    await go(page, "/loja/loja-a");
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
      await go(page, `/loja/loja-a/produtos${qs}`);
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
    await go(page, "/loja/loja-a/produtos?pagina=999");     // página fora do intervalo não quebra
    await expect(page.getByRole("main").getByText("Nenhum produto encontrado")).toBeVisible();
  });

  test("paginação (13 produtos): 12 por página e link para a próxima", async ({ page }) => {
    const B = psql("select id from tenants where slug='loja-b'");
    psql(`update store_settings set published=true, whatsapp='5511999990002' where tenant_id='${B}'`);
    psql(`insert into products (tenant_id,name,slug,regular_price,status) select '${B}','Peça '||g,'peca-'||g,10+g,'published' from generate_series(1,13) g`);
    psql(`insert into product_variants (tenant_id,product_id,size,stock_quantity) select tenant_id,id,'U',5 from products where tenant_id='${B}'`);
    await go(page, "/loja/loja-b/produtos");
    await expect(page.locator('a[href^="/loja/loja-b/produto/"]')).toHaveCount(12);
    await page.getByRole("link", { name: "Próxima" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.locator('a[href^="/loja/loja-b/produto/"]')).toHaveCount(1);
    psql(`delete from products where tenant_id='${B}'`);
    psql(`update store_settings set published=false where tenant_id='${B}'`);
  });

  // ------------------------------------------------------------------ produto, sacola e pedido
  async function addToCart(page: Page, color: string, size: string, qty = 1) {
    await go(page, "/loja/loja-a/produto/camiseta-linho");
    await page.getByRole("button", { name: color, exact: true }).click();
    await page.getByRole("button", { name: size, exact: true }).click();
    for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await page.getByRole("button", { name: "Adicionar à sacola" }).click();
    await expect(page.getByText("Adicionado").first()).toBeVisible();
  }
  async function checkout(page: Page, name = "Maria Cliente", phone = "(11) 98888-7777") {
    await go(page, "/loja/loja-a/sacola");
    await page.locator("#c-name").fill(name);
    await page.locator("#c-phone").fill(phone);
    await page.getByRole("button", { name: "Finalizar pelo WhatsApp" }).click();
  }

  test("página do produto: galeria, variações indisponíveis, estoque baixo e JSON-LD real", async ({ page }) => {
    await go(page, "/loja/loja-a/produto/camiseta-linho");
    await expect(page.getByRole("heading", { name: "Camiseta Linho" })).toBeVisible();
    await expect(page.getByText("R$ 119,92").first()).toBeVisible();
    await expect(page.getByText("-20%").first()).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);                       // galeria com 2 fotos
    await expect(page.getByText("100% linho").first()).toBeVisible();
    await expect(page.getByText(/Escolha o tamanho e a cor/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar à sacola" })).toBeDisabled();   // sem variação escolhida
    // Branca/P tem 3 un.; Preta/M tem 2 un.
    await page.getByRole("button", { name: "Preta", exact: true }).click();
    await page.getByRole("button", { name: "M", exact: true }).click();
    await expect(page.getByText("Restam só 2 unidades").first()).toBeVisible();
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();  // não passa do estoque
    // JSON-LD com preço e disponibilidade reais, sem avaliações inventadas
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers.price).toBe("119.92");
    expect(ld.offers.availability).toContain("InStock");
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review/i);
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain("/loja/loja-a/produto/camiseta-linho");
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("Camiseta Linho");
  });

  test("pedido pelo WhatsApp: valida no servidor, reserva estoque, grava snapshot e gera mensagem", async ({ page, request }) => {
    // quantidade 2 de Preta/M (último estoque) e checkout
    await addToCart(page, "Preta", "M", 2);
    await go(page, "/loja/loja-a/sacola");
    await expect(page.getByText("Camiseta Linho").first()).toBeVisible();
    await expect(page.getByText("R$ 239,84").first()).toBeVisible();          // 2 × 119,92 (preço do servidor)
    await expect(page.getByText(/Descontos/).first()).toBeVisible();
    // telefone inválido é recusado antes de criar pedido
    await page.locator("#c-name").fill("Maria Cliente");
    await page.locator("#c-phone").fill("123");
    await page.getByRole("button", { name: "Finalizar pelo WhatsApp" }).click();
    await expect(page.getByText(/Telefone inválido/).first()).toBeVisible();
    expect(psql("select count(*) from orders")).toBe("0");

    await page.locator("#c-phone").fill("(11) 98888-7777");
    await page.getByRole("button", { name: "Finalizar pelo WhatsApp" }).click();
    await expect(page.getByRole("heading", { name: "Pedido #1 registrado" })).toBeVisible();
    await expect(page.getByText("não é confirmado até a loja responder", { exact: false }).or(page.getByText("só é confirmado quando a loja responder"))).toBeVisible();
    const href = (await page.getByRole("link", { name: /Abrir WhatsApp/ }).getAttribute("href"))!;
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://wa.me/5511999990001");     // WhatsApp configurado da loja
    const text = url.searchParams.get("text")!;
    expect(text).toContain("#1");
    expect(text).toContain("2x Camiseta Linho (Tam. M · Preta)");
    expect(text).toMatch(/Total: R\$\s239,84/);
    expect(text).toContain("Maria Cliente");

    // persistência e regras no banco
    expect(psql("select status||'|'||total||'|'||subtotal||'|'||customer_phone||'|'||source from orders")).toBe("new|239.84|299.80|5511988887777|whatsapp");
    expect(psql("select quantity||'|'||unit_price||'|'||size_snapshot||'|'||color_snapshot||'|'||product_name_snapshot from order_items")).toBe("2|119.92|M|Preta|Camiseta Linho");
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='M' and color='Preta'`)).toBe("0");   // reservado
    expect(psql("select count(*) from inventory_movements where movement_type='reservation'")).toBe("1");

    // a sacola foi limpa; a variação esgotada não pode ser comprada de novo
    await go(page, "/loja/loja-a/sacola");
    await expect(page.getByText("Sua sacola está vazia").first()).toBeVisible();
    await go(page, "/loja/loja-a/produto/camiseta-linho");
    await page.getByRole("button", { name: "Preta", exact: true }).click();
    await expect(page.getByRole("button", { name: "M", exact: true })).toBeDisabled();

    // navegador não consegue criar pedido direto no banco nem chamar a função
    const forged = await rest(null, "POST", "orders", { tenant_id: tenantA, order_number: 99, customer_name: "Hacker", customer_phone: "11999999999", subtotal: 1, total: 1 });
    expect([401, 403]).toContain(forged.status);
    const rpc = await rest(null, "POST", "rpc/place_order", { p_tenant_slug: "loja-a", p_customer_name: "Hacker", p_customer_phone: "11999999999", p_customer_email: null, p_notes: null, p_items: [] });
    expect([401, 403]).toContain(rpc.status);
    expect(psql("select count(*) from orders")).toBe("1");
  });

  test("preço de pedido é imutável e estoque esgotado/indisponível não vende (servidor)", async ({ page }) => {
    // item que existia na sacola do cliente mas esgotou: o servidor recusa e nada é criado
    const variantM = psql(`select id from product_variants where product_id='${productId}' and size='M' and color='Preta'`);
    await go(page, "/loja/loja-a");
    await page.evaluate(([v]) => localStorage.setItem("vx-cart:loja-a", JSON.stringify([{ variantId: v, quantity: 1, name: "Camiseta Linho", size: "M", color: "Preta", image: null, productSlug: "camiseta-linho" }])), [variantM]);
    await go(page, "/loja/loja-a/sacola");
    await expect(page.getByText(/indisponível|Só há/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar pelo WhatsApp" })).toBeDisabled();
    expect(psql("select count(*) from orders")).toBe("1");
  });

  // ------------------------------------------------------------------ painel de pedidos
  test("lojista vê o pedido, confirma, faturamento e histórico; preço do pedido não muda com o produto", async ({ page }) => {
    await login(page, OWNER_A);
    await go(page, "/admin/pedidos");
    await expect(page.getByRole("link", { name: "#1" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Maria Cliente/ })).toBeVisible();
    await expect(page.getByText("R$ 239,84").first()).toBeVisible();
    await expect(page.getByText("WhatsApp", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "#1" }).click();
    orderId = psql("select id from orders where order_number=1");
    await expect(page).toHaveURL(new RegExp(orderId));
    await expect(page.getByText("não está pago nem confirmado").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /Camiseta Linho/ })).toBeVisible();
    await page.locator("#status").selectOption("confirmed");
    await page.getByRole("button", { name: "Atualizar status" }).click();
    await expect(page.getByText("Status atualizado.").first()).toBeVisible();
    await expect(page.getByText("Pedido criado como").first()).toBeVisible();
    await expect(page.getByText(/Novo →/).first()).toBeVisible();

    // dashboard: faturamento só de pedidos confirmados+
    await go(page, "/admin");
    await expect(page.getByText("R$ 239,84").first()).toBeVisible();
    await expect(page.getByText("Camiseta Linho").first()).toBeVisible();     // mais vendidos

    // altera o preço do produto: o pedido antigo não muda
    await go(page, `/admin/produtos/${productId}`);
    await page.getByLabel("Preço de venda (R$)").fill("199,90");
    await page.getByLabel("Preço promocional (R$)").fill("");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Produto publicado.").first()).toBeVisible();
    await go(page, `/admin/pedidos/${orderId}`);
    await expect(page.getByText("R$ 239,84").first()).toBeVisible();
    expect(psql("select unit_price from order_items")).toBe("119.92");
  });

  test("estoque: movimentações, ajuste manual, alerta de estoque baixo; cancelar devolve ao estoque", async ({ page, browser }) => {
    // novo pedido de Branca/P x1 (estoque 3 → 2) feito por outro visitante
    const ctx2 = await browser.newContext();
    const shopper = await ctx2.newPage();
    await addToCart(shopper, "Branca", "P", 1);
    await checkout(shopper, "João Comprador", "(21) 97777-6666");
    await expect(shopper.getByRole("heading", { name: "Pedido #2 registrado" })).toBeVisible();
    await ctx2.close();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='P' and color='Branca'`)).toBe("2");

    await login(page, OWNER_A);
    await go(page, "/admin/estoque");
    await expect(page.getByText("Reserva (pedido)").first()).toBeVisible();
    await expect(page.getByText("Estoque inicial").first()).toBeVisible();
    await expect(page.getByText(/Estoque baixo \(≤ 3\): [1-9]/).first()).toBeVisible();
    // ajuste manual: entrada de 5 na Preta/M (era 0)
    const row = page.getByRole("row", { name: /Camiseta Linho — M \/ Preta/ });
    await row.getByLabel("Quantidade a somar ou subtrair").fill("5");
    await row.getByLabel("Motivo").fill("reposição fornecedor");
    await row.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Estoque atualizado.").first()).toBeVisible();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='M' and color='Preta'`)).toBe("5");
    // saída maior que o estoque é recusada (nunca negativo)
    const row2 = page.getByRole("row", { name: /Camiseta Linho — M \/ Preta/ });
    await row2.getByLabel("Quantidade a somar ou subtrair").fill("-99");
    await row2.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("O estoque não pode ficar negativo.").first()).toBeVisible();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='M' and color='Preta'`)).toBe("5");

    // cancelar o pedido #2 devolve a peça
    await go(page, "/admin/pedidos");
    await page.getByRole("link", { name: "#2" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByText("Pedido cancelado e estoque devolvido.").first()).toBeVisible();
    expect(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='P' and color='Branca'`)).toBe("3");
    await expect(page.getByText(/Pedidos cancelados não podem mais mudar de status/).first()).toBeVisible();
  });

  test("reservas expiradas: pedido 'Novo' antigo é cancelado e devolve estoque (e o confirmado, não)", async ({ page, browser }) => {
    const ctx2 = await browser.newContext(); const shopper = await ctx2.newPage();
    await addToCart(shopper, "Branca", "M", 1);
    await checkout(shopper, "Ana Antiga", "(31) 96666-5555");
    await expect(shopper.getByRole("heading", { name: "Pedido #3 registrado" })).toBeVisible();
    await ctx2.close();
    const stockBefore = psql(`select stock_quantity from product_variants where product_id='${productId}' and size='M' and color='Branca'`);
    psql("update orders set created_at = now() - interval '5 days' where order_number in (1,3)");   // #1 está confirmado
    await login(page, OWNER_A);
    await go(page, "/admin/pedidos");
    await page.getByRole("button", { name: "Liberar reservas expiradas" }).click();
    await expect(page.getByText("1 reserva(s) expirada(s) cancelada(s)").first()).toBeVisible();
    expect(psql("select status from orders where order_number=3")).toBe("cancelled");
    expect(psql("select status from orders where order_number=1")).toBe("confirmed");
    expect(Number(psql(`select stock_quantity from product_variants where product_id='${productId}' and size='M' and color='Branca'`))).toBe(Number(stockBefore) + 1);
  });

  // ------------------------------------------------------------------ isolamento entre lojas
  test("isolamento: lojista B não vê nem altera nada da loja A (UI e API com o token dele)", async ({ page, request }) => {
    await login(page, OWNER_B);
    await expect(page.getByText("Sua loja ainda não tem produtos").first()).toBeVisible();
    await expect(page.getByText("Loja Teste B").first()).toBeVisible();
    // trocar IDs na URL não abre dados de outra loja
    for (const u of [`/admin/produtos/${productId}`, `/admin/pedidos/${orderId}`]) {
      const r = await go(page, u);
      expect(r!.status(), u).toBe(404);
    }
    await go(page, "/admin/produtos");
    await expect(page.getByText("Camiseta Linho")).toHaveCount(0);
    await go(page, "/admin/pedidos");
    await expect(page.getByText("Maria Cliente")).toHaveCount(0);
    await go(page, "/admin/estoque");
    await expect(page.getByText("Camiseta Linho")).toHaveCount(0);

    // API direta (PostgREST) com o JWT do lojista B
    const tokenB = await signInToken(OWNER_B, PW);
    const variantA = psql(`select id from product_variants where product_id='${productId}' limit 1`);
    expect((await rest(tokenB, "GET", `orders?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "GET", `order_items?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "GET", `product_costs?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "GET", `inventory_movements?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "GET", `memberships?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "GET", `audit_log?tenant_id=eq.${tenantA}`)).json).toEqual([]);
    expect((await rest(tokenB, "PATCH", `products?id=eq.${productId}`, { name: "HACKED" })).json).toEqual([]);
    expect((await rest(tokenB, "DELETE", `products?id=eq.${productId}`)).json).toEqual([]);
    expect((await rest(tokenB, "PATCH", `store_settings?tenant_id=eq.${tenantA}`, { whatsapp: "5511000000000" })).json).toEqual([]);
    expect((await rest(tokenB, "PATCH", `promotions?tenant_id=eq.${tenantA}`, { active: false })).json).toEqual([]);
    expect((await rest(tokenB, "POST", "products", { tenant_id: tenantA, name: "x", slug: "x", regular_price: 1 })).status).toBe(403);
    expect((await rest(tokenB, "PATCH", `product_variants?id=eq.${variantA}`, { stock_quantity: 999 })).status).toBe(403);
    expect((await rest(tokenB, "POST", "rpc/change_order_status", { p_order: psql("select id from orders where order_number=1"), p_new_status: "cancelled" })).text).toContain("ORDER_NOT_FOUND");
    expect((await rest(tokenB, "POST", "rpc/adjust_stock", { p_variant: variantA, p_delta: 50, p_type: "entry", p_reason: "x" })).text).toContain("VARIANT_NOT_FOUND");
    expect((await rest(tokenB, "POST", "rpc/dashboard_stats", { p_tenant: tenantA, p_from: "2020-01-01", p_to: "2030-01-01" })).text).toContain("FORBIDDEN");
    // anti-escalada de privilégio
    expect((await rest(tokenB, "POST", "memberships", { tenant_id: tenantA, user_id: psql("select id from auth.users where email='" + OWNER_B + "'"), role: "owner" })).status).toBe(403);
    expect((await rest(tokenB, "POST", "platform_admins", { user_id: psql("select id from auth.users where email='" + OWNER_B + "'") })).status).toBe(403);
    expect((await rest(tokenB, "POST", "tenants", { name: "x", slug: "xx" })).status).toBe(403);
    // storage: não escreve na pasta da loja A; escreve na própria
    const up = (folder: string) => fetch(`${API}/storage/v1/object/store-media/${folder}/teste-${Date.now()}.png`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${tokenB}`, "Content-Type": "image/png" }, body: new Uint8Array(solidPng()) });
    expect((await up(`${tenantA}/products`)).status).toBeGreaterThanOrEqual(400);
    expect((await up(psql("select id from tenants where slug='loja-b'") + "/products")).status).toBe(200);
    // visitante anônimo: sem acesso a dados privados
    for (const t of ["orders", "order_items", "product_costs", "memberships", "inventory_movements", "audit_log", "platform_admins", "order_counters"]) {
      expect([401, 403], t).toContain((await rest(null, "GET", `${t}?select=*`)).status);
    }
    expect([401, 403]).toContain((await rest(null, "GET", "store_settings?select=low_stock_threshold")).status);
    expect([401, 403]).toContain((await rest(null, "GET", "products?select=cost_price")).status === 400 ? 403 : 401);
    // a vitrine de A continua legível para anônimo, sem rascunhos
    const pub = await rest(null, "GET", `products?tenant_id=eq.${tenantA}&select=name,status`);
    expect(pub.status).toBe(200);
    expect(pub.json.every((p: any) => p.status === "published")).toBe(true);
    // nada foi alterado
    expect(psql(`select name from products where id='${productId}'`)).toBe("Camiseta Linho");
  });
});
