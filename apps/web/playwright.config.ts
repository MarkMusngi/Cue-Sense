import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./e2e/credentials";

// The stack (web, api, postgres) is started by Docker Compose, locally and in CI.
// Playwright does not start servers itself; point it elsewhere with E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Specs share one database and one seeded user (one open practice session at a
  // time), so run them one after another until specs get isolated data.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // The dev server compiles and hydrates slowly on a CI runner.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    // Every spec starts signed in as the seeded dev user (global-setup.ts).
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The first request to the Next.js dev server compiles the page, which is slow.
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
