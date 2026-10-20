import { clearLimits, ensureTestData } from "./limits";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(clearLimits);
test.beforeAll(ensureTestData);

const watch = (page: Page) => {
  const bad: string[] = [];
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/status of (400|401|403|404)/.test(m.text())) bad.push(`console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 500) bad.push(`HTTP ${r.status()} ${r.url()}`); });
  return bad;
};
const SIZES: [number, number][] = [[320, 568], [360, 640], [390, 700], [412, 560], [430, 932], [600, 700], [767, 800]];
const menu = (p: Page) => p.getByRole("dialog", { name: "Menu" });
const openBtn = (p: Page) => p.getByRole("button", { name: "Abrir menu" });

test("menu mobile: abre inteiro dentro da tela, rola por dentro e todos os itens são alcançáveis", async ({ page }) => {
  const bad = watch(page);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/produtos");
    await openBtn(page).click();
    await expect(menu(page)).toBeVisible();
    const box = await menu(page).boundingBox();
    expect(box, `${w}x${h}`).not.toBeNull();
    expect(box!.x, `esquerda ${w}x${h}`).toBeGreaterThanOrEqual(0);
    expect(box!.y, `topo ${w}x${h}`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `direita ${w}x${h}`).toBeLessThanOrEqual(w + 0.5);
    expect(box!.y + box!.height, `base ${w}x${h}`).toBeLessThanOrEqual(h + 0.5);
    expect(box!.height, `altura ${w}x${h}`).toBeGreaterThanOrEqual(h - 1); // ocupa a altura útil inteira
    // o último item precisa ser alcançável pela rolagem interna e ficar dentro da área visível
    const last = menu(page).getByRole("link", { name: "Sacola" });
    await last.scrollIntoViewIfNeeded();
    const lb = (await last.boundingBox())!;
    expect(lb.y + lb.height, `último item ${w}x${h}`).toBeLessThanOrEqual(h + 0.5);
    expect(lb.x).toBeGreaterThanOrEqual(0);
    for (const name of ["Lançamentos", "Todos os produtos", "Ofertas", "Favoritos"]) await expect(menu(page).getByRole("link", { name })).toHaveCount(1);
    // nada de rolagem horizontal da página
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(menu(page)).toHaveCount(0);
  }
  expect(bad).toEqual([]);
});

test("menu mobile: sobrepõe a página, bloqueia cliques atrás e devolve a interação ao fechar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/produtos?categoria=camisas");
  const before = page.url();
  const firstCardLink = page.locator('a[href^="/produto/"]:visible').first();
  await firstCardLink.waitFor();
  const pt = (await firstCardLink.boundingBox())!;
  const x = Math.min(380, pt.x + pt.width / 2), y = Math.min(770, pt.y + 40);
  await openBtn(page).click();
  // o elemento que recebe o toque numa área que fica ATRÁS do menu é a camada do menu, não o produto
  const hit = await page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el?.closest('a[href^="/produto/"]') ? "produto" : "camada"; }, [x, y]);
  expect(hit).toBe("camada");
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  // tocar fora fecha
  await page.mouse.click(385, 400);
  await expect(menu(page)).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  expect(page.url()).toBe(before); // nada foi clicado atrás nem a página mudou
  const hit2 = await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.closest('a[href^="/produto/"]'), [x, y]);
  expect(hit2).toBe(true);
  // Escape fecha
  await openBtn(page).click(); await page.keyboard.press("Escape"); await expect(menu(page)).toHaveCount(0);
});

test("menu mobile: abrir/fechar repetidamente, fechar ao navegar e não reabrir sozinho", async ({ page }) => {
  const bad = watch(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  for (let i = 0; i < 12; i++) { await openBtn(page).click(); await expect(menu(page)).toBeVisible(); await page.getByRole("button", { name: "Fechar menu" }).click(); await expect(menu(page)).toHaveCount(0); }
  await openBtn(page).click();
  await menu(page).getByRole("button", { name: /Camisas|Calças|Calçados|Roupas|Acessórios/i }).first().click().catch(() => undefined);
  await menu(page).getByRole("link", { name: "Todos os produtos" }).click();
  await expect(page).toHaveURL(/\/produtos$/);
  await expect(menu(page)).toHaveCount(0);
  await page.goBack();
  await expect(menu(page)).toHaveCount(0);
  await page.goForward();
  await expect(menu(page)).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  expect(bad).toEqual([]);
});

async function addBySize(page: Page, slug: string, size: string, colorIdx = 0) {
  await page.goto(`/produto/${slug}`);
  const cores = page.getByRole("button", { pressed: false }).filter({ has: page.locator("span.rounded-full") });
  if ((await cores.count()) > 1) await cores.nth(colorIdx).click();
  await page.getByRole("button", { name: size, exact: true }).click();
  await page.getByRole("button", { name: "Adicionar à sacola", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Adicionado à sacola");
  await page.getByRole("button", { name: "Continuar comprando" }).click();
}

test("logo/nome Outlet 3K leva à Home em todas as páginas e o carrinho é preservado", async ({ page }) => {
  const bad = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await addBySize(page, "moletom-basico-com-capuz-taupe", "M");
  await page.goto("/produtos?categoria=tenis");
  const tenis = (await page.locator('a[href^="/produto/"]').first().getAttribute("href"))!;
  await page.goto("/produtos?categoria=calcas");
  const calca = (await page.locator('a[href^="/produto/"]').first().getAttribute("href"))!;
  const tamanhoQualquer = async (href: string) => {
    await page.goto(href);
    const cores = page.getByRole("button", { pressed: false }).filter({ has: page.locator("span.rounded-full") });
    if ((await cores.count()) > 1) await cores.first().click();
    await page.locator("button:not([disabled])[aria-pressed='false']").filter({ hasText: /^(PP|P|M|G|GG|XG|\d{2})$/ }).first().click();
    await page.getByRole("button", { name: "Adicionar à sacola", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Adicionado à sacola");
    await page.getByRole("button", { name: "Continuar comprando" }).click();
  };
  await tamanhoQualquer(tenis);
  await tamanhoQualquer(calca);
  await tamanhoQualquer(calca); // mesma variação de novo: soma quantidade, não duplica a linha

  await page.goto("/carrinho");
  const lines = page.locator("ul.space-y-3 > li");
  await expect(lines).toHaveCount(3);
  const snapshot = async () => ({
    texts: await lines.evaluateAll((els) => els.map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())),
    total: await page.locator("dl").first().innerText(),
  });
  const before = await snapshot();
  expect(before.texts.some((t) => /Moletom/.test(t) && / M /.test(t + " "))).toBe(true);

  for (const path of ["/produtos", `${calca}`, "/carrinho", "/checkout", "/produtos?q=moletom"]) {
    await page.goto(path);
    // nome (texto) do cabeçalho é um link para a Home
    const logo = page.locator("header").getByRole("link", { name: /Outlet 3K — página inicial/ });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/");
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /Sacola, 5 itens|Sacola, 4 itens/ })).toBeVisible();
  }
  await page.goto("/carrinho");
  await expect(lines).toHaveCount(3);
  expect(await snapshot()).toEqual(before);
  // rodapé também leva à Home
  await page.goto("/carrinho");
  await page.locator("footer").getByRole("link", { name: /página inicial/ }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(bad).toEqual([]);
});

test("desempenho: cliques em produtos respondem rápido e sem erros", async ({ page }) => {
  const bad = watch(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/produtos");
  const hrefs = await page.locator('a[href^="/produto/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))].slice(0, 6));
  expect(hrefs.length).toBeGreaterThanOrEqual(5);
  const times: number[] = [];
  for (const h of hrefs) {
    await page.goto("/produtos");
    const t0 = Date.now();
    await page.locator(`a[href="${h}"]`).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Comprar" })).toBeVisible();
    times.push(Date.now() - t0);
  }
  console.log("tempos de clique→produto (ms):", times.join(", "));
  expect(Math.max(...times)).toBeLessThan(2500);
  expect(bad).toEqual([]);
});
