import { defineConfig, devices } from "@playwright/test";

// The stack (web, api, postgres) is started by Docker Compose, locally and in CI.
// Playwright does not start servers itself; point it elsewhere with E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // Specs share one database and one seeded user (one open practice session at a
  // time), so run them one after another until specs get isolated data.
  fullyParallel: false,
  workers: 1,
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
