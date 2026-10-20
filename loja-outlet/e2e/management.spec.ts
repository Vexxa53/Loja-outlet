import { clearLimits } from "./limits";
import { pickColor, pickSize, setStock } from "./variants";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { makePng, makeJpeg, makeWebp } from "./images";

const stamp = Date.now();
const NAME = `Camisa Teste ${stamp}`;
const png = (rgb: [number, number, number], w = 600, h = 800) => ({ name: "foto.png", mimeType: "image/png", buffer: makePng(w, h, rgb) });

const errors: string[] = [];
function watch(page: Page) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (400|401|403|404)/.test(m.text())) errors.push(`console: ${m.text()}`); });
}

async function login(page: Page, email = "admin@teste.local", pass = "SenhaTeste123") {
  await page.goto("/admin/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.endsWith("/login"));
}

const open = async (d: Locator) => { if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open))) await d.locator("summary").click(); };
const slide = (p: Page, t: string) => p.locator('section[aria-roledescription="carrossel"] h2', { hasText: t });
const cardOnStore = (page: Page, q: string) => page.goto(`/produtos?q=${encodeURIComponent(q)}`);

test.beforeEach(clearLimits);

test.describe.configure({ mode: "serial" });

test("produto: cadastro com upload, edição, troca de imagem, status e exclusão", async ({ page, browser }) => {
  watch(page);
  await login(page);

  // 1) cadastrar com foto enviada por upload
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome do produto").fill(NAME);
  await page.getByLabel("Código (SKU)").fill(`T-${stamp}`);
  await page.getByLabel("Preço de venda (R$)").fill("100,00");
  await page.getByLabel(/Preço promocional/).fill("80,00");
  await page.getByLabel("Situação na loja").selectOption("PUBLISHED");
  await page.getByLabel("Descrição completa").fill("Descrição completa do produto de teste.");
  await page.locator('input[aria-label="Escolher fotos do produto"]').setInputFiles(png([200, 30, 30]));
  await expect(page.getByAltText("Prévia")).toBeVisible(); // pré-visualização antes de salvar
  await pickSize(page, "M"); await pickColor(page, "Vermelho"); await setStock(page, "M", "Vermelho", "5");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso!")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/produtos\/[a-z0-9]+\?ok=/);
  const editUrl = page.url().split("?")[0];
  const img1 = await page.getByAltText("Foto 1").getAttribute("src");
  expect(img1).toMatch(/^\/uploads\/products\/.+\.png$/);

  // 2) aparece na loja, com a imagem carregando e o selo de desconto
  const store = await browser.newPage(); watch(store);
  await cardOnStore(store, NAME);
  await expect(store.getByRole("heading", { name: NAME, level: 3 })).toBeVisible();
  await expect(store.getByText("-20%").first()).toBeVisible();
  await store.getByRole("heading", { name: NAME, level: 3 }).click();
  await expect(store).toHaveURL(/\/produto\//);
  await expect(store.getByRole("heading", { name: NAME, level: 1 })).toBeVisible();
  await expect.poll(() => store.locator("main img").first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  const storeUrl = store.url();

  // 3) alterar nome e preço
  await page.goto(editUrl);
  await page.getByLabel("Nome do produto").fill(`${NAME} Editada`);
  await page.getByLabel("Preço de venda (R$)").fill("120,00");
  await page.getByLabel(/Preço promocional/).fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  await store.reload();
  await expect(store.getByRole("heading", { name: `${NAME} Editada` })).toBeVisible();
  await expect(store.getByText("R$ 120,00").first()).toBeVisible();

  // 4) substituir imagem
  await page.reload();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Trocar" }).click();
  await (await chooser).setFiles(png([20, 120, 220]));
  await expect(page.getByText("Imagem substituída.")).toBeVisible();
  await page.reload();
  const img2 = await page.getByAltText("Foto 1").getAttribute("src");
  expect(img2).not.toBe(img1);
  expect((await page.request.get(img1!)).status()).toBe(404); // a antiga foi apagada do armazenamento
  expect((await page.request.get(img2!)).status()).toBe(200);

  // 5) adicionar 2ª foto pela galeria e reordenar
  await page.locator('input[aria-label="Escolher fotos do produto"]').setInputFiles(png([10, 200, 10]));
  await expect(page.getByText(/enviada\(s\) com sucesso/)).toBeVisible();
  await expect(page.getByAltText("Foto 2")).toBeVisible();
  await page.getByRole("button", { name: "Mover para antes" }).nth(1).click();
  await expect(page.getByText("Ordem das imagens atualizada.")).toBeVisible();

  // 6) inativo some da loja; indisponível aparece sem botão de compra; ativo volta
  const setStatus = async (value: string) => {
    await page.goto(editUrl);
    await page.getByLabel("Situação na loja").selectOption(value);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(/Alterações salvas/)).toBeVisible();
  };
  await setStatus("DRAFT");
  await cardOnStore(store, NAME);
  await expect(store.getByRole("heading", { name: `${NAME} Editada`, level: 3 })).toHaveCount(0);
  expect((await store.goto(storeUrl))?.status()).toBe(404);
  await setStatus("UNAVAILABLE");
  await cardOnStore(store, NAME);
  await expect(store.getByText("Indisponível").first()).toBeVisible();
  await store.goto(storeUrl);
  await expect(store.getByText("Este produto está indisponível no momento.")).toBeVisible();
  await expect(store.getByRole("button", { name: /Comprar|Adicionar à sacola/ })).toHaveCount(0);
  await setStatus("PUBLISHED");
  await store.goto(storeUrl);
  await expect(store.getByRole("button", { name: "Comprar" })).toBeVisible();

  // 7) persistência: sair, entrar de novo e conferir
  await page.getByRole("button", { name: "Sair" }).click();
  await login(page);
  await page.goto(editUrl);
  await expect(page.getByLabel("Nome do produto")).toHaveValue(`${NAME} Editada`);
  await expect(page.getByAltText("Foto 1")).toBeVisible();

  // 8) exclusão com confirmação (cancelar mantém; confirmar exclui)
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByLabel("Nome do produto")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByText("Produto excluído.")).toBeVisible();
  expect((await store.goto(storeUrl))?.status()).toBe(404);
  expect((await page.request.get(img2!)).status()).toBe(404); // arquivos removidos junto
  await store.close();
});

test("upload: formatos e tamanhos inválidos mostram mensagens claras", async ({ page }) => {
  watch(page);
  await login(page);
  await page.goto("/admin/produtos/novo");
  const input = page.locator('input[aria-label="Escolher fotos do produto"]');
  // maior que 4 MB: barrado no navegador
  await input.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.concat([makePng(), Buffer.alloc(5 * 1024 * 1024)]) });
  await expect(page.getByText(/mais de 4 MB/)).toBeVisible();
  // formato errado: barrado no navegador
  await input.setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText(/formato não aceito/)).toBeVisible();
  // arquivo disfarçado de PNG: passa no navegador, o servidor recusa pelo conteúdo
  await page.reload();
  await page.getByLabel("Nome do produto").fill(`Disfarce ${stamp}`);
  await page.getByLabel("Código (SKU)").fill(`D-${stamp}`);
  await page.getByLabel("Preço de venda (R$)").fill("10,00");
  await page.getByLabel("Situação na loja").selectOption("DRAFT");
  await page.locator('input[aria-label="Escolher fotos do produto"]').setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("não sou uma imagem") });
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText(/não foram enviadas/)).toBeVisible();
  // JPG e WebP reais são aceitos (a página agora é a do produto salvo: o envio é imediato)
  await page.locator('input[aria-label="Escolher fotos do produto"]').setInputFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: makeJpeg() }, { name: "b.webp", mimeType: "image/webp", buffer: makeWebp() }]);
  await expect(page.getByText(/2 imagem\(ns\) enviada\(s\) com sucesso/)).toBeVisible();
  // publicar sem variação é barrado com mensagem em português
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome do produto").fill(`Sem variacao ${stamp}`);
  await page.getByLabel("Código (SKU)").fill(`SV-${stamp}`);
  await page.getByLabel("Preço de venda (R$)").fill("10,00");
  await page.getByLabel("Situação na loja").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText(/ative ao menos uma variação/).first()).toBeVisible();
  // preço promocional maior que o preço é barrado
  await page.getByLabel("Situação na loja").selectOption("DRAFT");
  await page.getByLabel(/Preço promocional/).fill("20,00");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText(/preço promocional precisa ser menor/).first()).toBeVisible();
});

test("banners: cadastro, edição, ordem, dispositivo, ativar/desativar, exclusão", async ({ page, browser }) => {
  watch(page);
  await login(page);
  await page.goto("/admin/banners");
  const T1 = `Banner A ${stamp}`; const T2 = `Banner B ${stamp}`;
  const create = async (title: string, rgb: [number, number, number], mobile?: [number, number, number], device = "all") => {
    const form = page.locator("section", { hasText: "Novo banner" }).first();
    await form.getByLabel("Título", { exact: true }).fill(title);
    await form.getByLabel("Texto do botão — opcional").fill("Ver agora");
    await form.getByLabel("Link de destino — opcional").fill("/produtos");
    await form.locator('input[aria-label^="Imagem do computador"]').setInputFiles(png(rgb, 1920, 800));
    await expect(form.getByAltText("Prévia da imagem").first()).toBeVisible();
    if (mobile) await form.locator('input[aria-label^="Imagem do celular"]').setInputFiles(png(mobile, 900, 1100));
    await form.getByLabel("Exibir em").selectOption(device);
    await expect(form.getByText(/Enviando/)).toHaveCount(0, { timeout: 15000 });
    await form.getByRole("button", { name: "Publicar banner" }).click();
    await expect(form.getByText("Banner publicado!")).toBeVisible();
  };
  // sem banners ativos de teste, a home usa slides padrão (sem erros)
  const home = await browser.newPage(); watch(home);
  await create(T1, [200, 30, 30], [30, 30, 200]);
  await create(T2, [30, 200, 30]);
  await page.reload();
  await expect(page.getByText(T1).first()).toBeVisible();

  // aparecem no carrossel da loja
  await home.goto("/");
  await expect(slide(home, T1)).toBeAttached();
  await expect(slide(home, T2)).toBeAttached();
  const src = await home.locator('section[aria-roledescription="carrossel"] img').first().evaluate((i: HTMLImageElement) => i.currentSrc);
  expect(src).toContain("/uploads/banners/");

  // versão celular usa a imagem própria do celular
  const m = await browser.newPage({ viewport: { width: 375, height: 800 } }); watch(m);
  await m.goto("/");
  const mSrc = await m.locator('section[aria-roledescription="carrossel"] img').first().evaluate((i: HTMLImageElement) => i.currentSrc);
  expect(mSrc).toContain("/uploads/banners/");
  expect(mSrc).not.toBe(src);
  expect(Math.abs(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))).toBeLessThanOrEqual(0);

  // editar título
  const details = page.locator("details", { hasText: T1 });
  await open(details);
  await details.getByLabel("Título", { exact: true }).fill(`${T1} editado`);
  await details.getByRole("button", { name: "Salvar banner" }).click();
  await expect(details.getByText(/Banner atualizado/)).toBeVisible();
  await home.reload();
  await expect(home.getByRole("heading", { name: `${T1} editado` })).toBeAttached();

  // substituir imagem do computador (a antiga é apagada)
  const oldSrc = await page.locator("details", { hasText: `${T1} editado` }).locator("summary img").getAttribute("src");
  const d2 = page.locator("details", { hasText: `${T1} editado` });
  await d2.locator('input[aria-label^="Imagem do computador"]').setInputFiles(png([250, 250, 250], 1920, 800));
  await expect(d2.getByText(/Enviando/)).toHaveCount(0, { timeout: 15000 });
  await d2.getByRole("button", { name: "Salvar banner" }).click();
  await expect(d2.getByText(/Banner atualizado/)).toBeVisible();
  await page.reload();
  const newSrc = await page.locator("details", { hasText: `${T1} editado` }).locator("summary img").getAttribute("src");
  expect(newSrc).not.toBe(oldSrc);
  expect((await page.request.get(oldSrc!)).status()).toBe(404);

  // ordem: subir o B para antes do A
  const b = page.locator("details", { hasText: T2 });
  await open(b);
  await b.getByRole("button", { name: "Subir na ordem" }).click();
  await expect(page.getByText("Ordem atualizada.")).toBeVisible();
  await home.reload();
  await expect(home.locator('section[aria-roledescription="carrossel"] h2').first()).toHaveText(T2);

  // só celular: some do computador, aparece no celular
  const b2 = page.locator("details", { hasText: T2 });
  await open(b2);
  await b2.getByLabel("Exibir em").selectOption("mobile");
  await b2.getByRole("button", { name: "Salvar banner" }).click();
  await expect(b2.getByText(/Banner atualizado/)).toBeVisible();
  await home.reload();
  await expect(slide(home, T2)).toHaveCount(0);
  await m.reload();
  await expect(slide(m, T2)).toBeAttached();

  // desativar e reativar
  const b3 = page.locator("details", { hasText: T2 });
  await open(b3);
  await b3.getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText(/Banner desativado/)).toBeVisible();
  await m.reload();
  await expect(slide(m, T2)).toHaveCount(0);
  const b4 = page.locator("details", { hasText: T2 });
  await open(b4);
  await b4.getByRole("button", { name: "Ativar" }).click();
  await expect(page.getByText(/Banner ativado/)).toBeVisible();
  await m.reload();
  await expect(slide(m, T2)).toBeAttached();

  // persistência após logout/login
  await page.getByRole("button", { name: "Sair" }).click();
  await login(page);
  await page.goto("/admin/banners");
  await expect(page.getByText(T2).first()).toBeVisible();

  // exclusão com confirmação
  for (const t of [`${T1} editado`, T2]) {
    const d = page.locator("details", { hasText: t });
    await open(d);
    page.once("dialog", (dlg) => dlg.accept());
    await d.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Banner excluído.")).toBeVisible();
  }
  await home.reload();
  await expect(home.locator('section[aria-roledescription="carrossel"] h2').first()).toBeVisible(); // slides padrão, sem quebra
  await home.close(); await m.close();
});

test("permissões: upload exige login e permissão no servidor", async ({ page, request, browser }) => {
  watch(page);
  const anon = await request.post("/api/admin/upload", { multipart: { kind: "banner", file: { name: "a.png", mimeType: "image/png", buffer: makePng() } } });
  expect(anon.status()).toBe(401);
  await login(page);
  await page.goto("/admin/usuarios");
  const f = page.locator("form", { has: page.locator("input[name=password]") }).first();
  await f.getByLabel("Nome").fill("Estoquista Upload");
  await f.getByLabel("E-mail", { exact: true }).fill(`up${stamp}@teste.local`);
  await f.getByLabel("Perfil").selectOption({ label: "Estoquista" });
  await f.getByLabel(/Senha inicial/).fill("SenhaEstoq123");
  await f.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText("Usuário salvo.")).toBeVisible();
  const ctx = await browser.newContext();
  const e = await ctx.newPage();
  await login(e, `up${stamp}@teste.local`, "SenhaEstoq123");
  for (const kind of ["banner", "product", "category", "brand"]) {
    const r = await ctx.request.post("/api/admin/upload", { multipart: { kind, productId: "x", file: { name: "a.png", mimeType: "image/png", buffer: makePng() } } });
    expect(r.status(), kind).toBe(403); // estoquista não tem permissão de conteúdo/produtos
  }
  await ctx.close();
  expect(errors, errors.join("\n")).toEqual([]);
});
