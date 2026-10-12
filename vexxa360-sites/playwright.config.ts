import { defineConfig } from "@playwright/test";

// E2E contra uma pilha Supabase LOCAL (tests/e2e/stack) e o app em modo produção (porta 3100).
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] },
    screenshot: "only-on-failure",
    trace: "off",
  },
});
