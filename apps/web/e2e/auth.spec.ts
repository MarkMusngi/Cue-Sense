import { expect, test } from "@playwright/test";

import { E2E_PASSWORD, E2E_USER } from "./credentials";

// These specs start signed out; every other spec starts signed in (global-setup.ts).
test.use({ storageState: { cookies: [], origins: [] } });

async function fillAndSubmit(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
}

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/drills");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a wrong password shows an error and stays on sign in", async ({ page }) => {
  await page.goto("/sign-in");

  await fillAndSubmit(page, E2E_USER, "definitely-not-the-password");

  await expect(page.getByTestId("auth-error")).toHaveText("The email or password is wrong.");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign in shows who is signed in, and sign out ends the session", async ({ page, context }) => {
  await page.goto("/sign-in");
  await fillAndSubmit(page, E2E_USER, E2E_PASSWORD);

  await expect(page).toHaveURL((url) => url.pathname === "/" || url.pathname === "/drills");
  await expect(page.getByTestId("sidebar-user-email")).toHaveText(E2E_USER);
  // The session cookie is HttpOnly: scripts cannot read it.
  expect(await page.evaluate(() => document.cookie)).not.toContain("cue_session");

  await page.getByTestId("sidebar-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto("/drills");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await context.cookies()).some((cookie) => cookie.name === "cue_session")).toBe(false);
});

test("a stale session cookie sends the visitor to sign in, and signing in again works", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "cue_session", value: "not-a-real-token", url: baseURL as string, httpOnly: true },
  ]);

  await page.goto("/drills");
  await expect(page).toHaveURL(/\/sign-in$/);

  await fillAndSubmit(page, E2E_USER, E2E_PASSWORD);
  await expect(page.getByTestId("sidebar-user-email")).toHaveText(E2E_USER);
});

test("a new account can be created and starts signed in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/sign-up");

  await fillAndSubmit(page, email, "a-long-test-password");

  await expect(page.getByTestId("sidebar-user-email")).toHaveText(email);
  await page.getByTestId("sidebar-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign up asks for a longer password", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByTestId("auth-password")).toHaveAttribute("minlength", "8");
});
