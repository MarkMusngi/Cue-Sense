import { chromium, type FullConfig } from "@playwright/test";

import { E2E_PASSWORD, E2E_USER, STORAGE_STATE } from "./credentials";

// Signs in once, through the real sign-in screen, and saves the browser state. Every spec
// starts from it, so each one runs as the seeded dev user. (Cookies belong to the host, not
// the port, so the API calls that specs make on port 8000 carry the same session.)
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  page.setDefaultNavigationTimeout(60_000);
  await page.goto("/sign-in");
  await page.getByTestId("auth-email").fill(E2E_USER);
  await page.getByTestId("auth-password").fill(E2E_PASSWORD);
  await page.getByTestId("auth-submit").click();
  try {
    await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  } catch {
    throw new Error(
      `Could not sign in as ${E2E_USER}. Run the seed with DEV_USER_PASSWORD set ` +
        "(docker compose exec api python -m app.scripts.seed), or set E2E_USER_EMAIL and E2E_USER_PASSWORD.",
    );
  }
  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}
