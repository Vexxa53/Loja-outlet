import { clearLimits } from "./limits";
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];
const STORE = ["/", "/produtos", "/produtos?q=moletom", "/produto/moletom-basico-com-capuz-taupe", "/carrinho", "/conta/entrar", "/conta/cadastrar", "/politicas/privacidade"];
const ADMIN = ["/admin", "/admin/produtos", "/admin/produtos/novo", "/admin/banners", "/admin/categorias", "/admin/estoque", "/admin/pedidos", "/admin/clientes", "/admin/cupons", "/admin/config", "/admin/config/pagamentos", "/admin/usuarios", "/admin/auditoria"];

const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Elementos clicáveis visíveis menores que 40px de altura (alvo de toque), ignorando checkbox/radio/arquivo ocultos. */
const smallTargets = (p: Page) => p.evaluate(() => {
  const out: string[] = [];
  document.querySelectorAll<HTMLElement>("button, a[href], select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, summary").forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") return;
    if (el.closest("[aria-hidden=true]") || el.classList.contains("sr-only")) return;
    // links dentro de texto corrido não contam
    if (el.tagName === "A" && el.closest("p, li:not([class]), td")) return;
    if (r.height < 40) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return out;
});

test.beforeEach(clearLimits);

test("loja: sem rolagem horizontal em todas as larguras", async ({ page }) => {
  test.setTimeout(200_000);
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const path of STORE) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const o = await overflow(page);
      if (o > 0) bad.push(`${w}px ${path}: +${o}px`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("loja: alvos de toque confortáveis no celular", async ({ page }) => {
  const bad: string[] = [];
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ["/", "/produtos", "/produto/moletom-basico-com-capuz-taupe", "/carrinho", "/conta/entrar"]) {
    await page.goto(path);
    for (const t of await smallTargets(page)) bad.push(`${path}: ${t}`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("admin: sem rolagem horizontal, menu em gaveta no celular, alvos de toque", async ({ page }) => {
  test.setTimeout(280_000);
  await page.goto("/admin/login");
  await page.locator("#email").fill("admin@teste.local");
  await page.locator("#password").fill("SenhaTeste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  const bad: string[] = [];
  await page.goto("/admin/produtos");
  const first = await page.locator('a[href^="/admin/produtos/"]:not([href$="novo"])').first().getAttribute("href", { timeout: 5000 }).catch(() => null);
  const routes = [...ADMIN, ...(first ? [first] : [])];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const path of routes) {
      await page.goto(path, { waitUntil: "load" });
      const o = await overflow(page);
      if (o > 0) bad.push(`${w}px ${path}: +${o}px`);
      if (w === 375) for (const t of await smallTargets(page)) bad.push(`375px ${path}: toque pequeno ${t}`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);

  // gaveta de navegação
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/admin");
  const drawer = page.locator("#admin-drawer");
  await expect(page.getByRole("button", { name: /Menu/ })).toBeVisible();
  expect(await drawer.boundingBox().then((b) => b!.x + b!.width)).toBeLessThanOrEqual(0); // fechada: fora da tela
  await page.getByRole("button", { name: /Menu/ }).click();
  await expect(drawer.getByRole("link", { name: "Produtos" })).toBeVisible();
  await drawer.getByRole("link", { name: "Produtos" }).click();
  await expect(page).toHaveURL(/\/admin\/produtos$/);
  await expect.poll(async () => drawer.boundingBox().then((b) => b!.x + b!.width), { timeout: 3000 }).toBeLessThanOrEqual(0); // fechou sozinha ao navegar
  // desktop: menu lateral fixo, sem botão de menu
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: /Menu/ })).toBeHidden();
  await expect(page.locator("#admin-drawer").getByRole("link", { name: "Pedidos" })).toBeVisible();
});
