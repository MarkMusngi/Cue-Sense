import { expect, test } from "@playwright/test";

test("home page shows the API and database health", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("health-status")).toBeVisible();
  await expect(page.getByTestId("health-api")).toHaveText("ok");
  await expect(page.getByTestId("health-database")).toHaveText("ok");
  await expect(page.getByTestId("health-error")).toHaveCount(0);
});
