import { defineConfig, devices } from "@playwright/test";

// The stack (web, api, postgres) is started by Docker Compose, locally and in CI.
// Playwright does not start servers itself; point it elsewhere with E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The first request to the Next.js dev server compiles the page, which is slow.
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
