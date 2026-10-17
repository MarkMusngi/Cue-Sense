import { expect, test } from "@playwright/test";

import { createDrillViaApi, endOpenSession } from "./helpers";

// Journey 3 of the end-to-end list: start a session, log ten attempts, finish, and confirm the
// totals in the history. (Journeys 1, 2 and 4 are in drills.spec.ts and table-editor.spec.ts.)

const RUN_URL = /\/sessions\/[0-9a-f-]{36}\/runs\/[0-9a-f-]{36}$/;
const SESSION_URL = /\/sessions\/[0-9a-f-]{36}$/;

test.beforeEach(async ({ request }) => {
  await endOpenSession(request);
});

test("ten attempts, a finished session, and the totals in the history", async ({ page, request }) => {
  const title = `Aaa e2e journey ${Date.now()}`;
  const drillId = await createDrillViaApi(request, title, {
    schema_version: 1,
    kind: "success_count",
    attempts_per_set: 10,
    pass_threshold: 6,
  });

  // Start a drill run from the drill: with no session open, that starts one.
  await page.goto(`/drills/${drillId}`);
  await expect(page.locator('[data-hydrated="true"]:has([data-testid="drill-detail-start-run"])')).toBeVisible();
  await page.getByTestId("drill-detail-start-run").click();
  await expect(page).toHaveURL(RUN_URL);
  await expect(page.getByTestId("runner")).toHaveAttribute("data-hydrated", "true");

  // Ten attempts: seven makes, two misses and a partial.
  const taps = ["success", "success", "fail", "success", "success", "partial", "success", "success", "fail", "success"];
  for (const outcome of taps) {
    await page.getByTestId(`runner-outcome-${outcome}`).click();
  }
  await expect(page.getByTestId("runner-status")).toHaveText("Set passed · 7 of 10");
  await expect(page.getByTestId("runner-run-total")).toHaveText("Run total 7 of 10");
  await expect(page.getByTestId("runner-undo")).toBeEnabled();

  await page.getByTestId("runner-end").click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(page.getByTestId("session-run-1")).toContainText(title);
  await expect(page.getByTestId("session-run-total-1")).toHaveText("7 of 10");

  await expect(page.locator('[data-hydrated="true"]:has([data-testid="session-finish"])')).toBeVisible();
  await page.getByTestId("session-finish").click();
  await expect(page.getByTestId("session-status")).toContainText("Finished");

  // The history lists the session, and opening it shows the same totals.
  await page.goto("/sessions");
  await expect(page.getByTestId("session-open")).toHaveCount(0);
  await page.getByTestId("session-list").getByRole("link").first().click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(page.getByTestId("session-status")).toContainText("Finished");
  await expect(page.getByTestId("session-run-1")).toContainText(title);
  await expect(page.getByTestId("session-run-total-1")).toHaveText("7 of 10");
});
