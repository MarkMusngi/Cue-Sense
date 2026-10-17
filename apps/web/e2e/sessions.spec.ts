import { expect, test, type Page } from "@playwright/test";

import { archiveDrillViaApi, createDrillViaApi, endOpenSession } from "./helpers";

// These specs use the seeded API. Each one ends any open practice session first (an owner has
// at most one) and makes its own drills through the API, with titles that sort first so the
// session's drill picker, which lists the first 100 drills, always includes them.

const RUN_URL = /\/sessions\/([0-9a-f-]{36})\/runs\/[0-9a-f-]{36}$/;
const SESSION_URL = /\/sessions\/[0-9a-f-]{36}$/;

function uniqueTitle(label: string) {
  return `Aaa e2e ${label} ${Date.now()}`;
}

const text = (page: Page, id: string) => page.getByTestId(id);

/** From a drill's detail screen, start a drill run and wait for the runner to be ready. */
async function startRunFromDrill(page: Page, drillId: string) {
  await page.goto(`/drills/${drillId}`);
  await expect(
    page.locator('[data-hydrated="true"]:has([data-testid="drill-detail-start-run"])'),
  ).toBeVisible();
  await page.getByTestId("drill-detail-start-run").click();
  await expect(page).toHaveURL(RUN_URL);
  await expect(page.getByTestId("runner")).toHaveAttribute("data-hydrated", "true");
}

test.beforeEach(async ({ request }) => {
  await endOpenSession(request);
});

test.describe("session runner", () => {
  test("logs attempts, undoes, survives a reload, ends the run and finishes the session", async ({
    page,
    request,
  }) => {
    const title = uniqueTitle("runner");
    const drillId = await createDrillViaApi(request, title);
    await startRunFromDrill(page, drillId);

    await expect(text(page, "runner-title")).toHaveText(title);
    await expect(text(page, "runner-version")).toHaveText("v1");
    await expect(text(page, "runner-status")).toHaveText("3 more makes to pass");

    // Make, Make, Miss, Partial: the tally and the sights follow each tap.
    await page.getByTestId("runner-outcome-success").click();
    await page.getByTestId("runner-outcome-success").click();
    await page.getByTestId("runner-outcome-fail").click();
    await page.getByTestId("runner-outcome-partial").click();
    await expect(text(page, "runner-made")).toHaveText("2");
    await expect(text(page, "runner-taken")).toHaveText("/4");
    await expect(text(page, "runner-status")).toHaveText("1 more make to pass");
    await expect(text(page, "runner-run-total")).toHaveText("Run total 2 of 4");
    await expect(page.getByTestId("rail-sight-2")).toHaveAttribute("data-mark", "fail");
    await expect(page.getByTestId("rail-sight-3")).toHaveAttribute("data-mark", "partial");
    // Once the server has answered, nothing is still being saved.
    await expect(page.getByTestId("rail-sight-3")).not.toHaveAttribute("data-mark", "pending");
    await expect(page.getByTestId("runner-undo")).toBeEnabled();

    // Undo the partial, then reload: the run and its undo are still there.
    await page.getByTestId("runner-undo").click();
    await expect(text(page, "runner-taken")).toHaveText("/3");
    await expect(text(page, "runner-last")).toHaveText("Attempt 3 · Miss");
    await page.reload();
    await expect(page.getByTestId("runner")).toHaveAttribute("data-hydrated", "true");
    await expect(text(page, "runner-taken")).toHaveText("/3");
    await expect(text(page, "runner-last")).toHaveText("Attempt 3 · Miss");
    await page.getByTestId("runner-undo").click();
    await expect(text(page, "runner-taken")).toHaveText("/2");

    // Make, Fail, Fail completes the set of five: passed with 3 makes.
    await page.getByTestId("runner-outcome-success").click();
    await expect(text(page, "runner-status")).toHaveText("Set passed");
    await page.getByTestId("runner-outcome-fail").click();
    await page.getByTestId("runner-outcome-fail").click();
    await expect(text(page, "runner-status")).toHaveText("Set passed · 3 of 5");
    await expect(text(page, "runner-set")).toHaveText("Set 1");

    // The next attempt starts set 2.
    await page.getByTestId("runner-outcome-success").click();
    await expect(text(page, "runner-set")).toHaveText("Set 2");
    await expect(text(page, "runner-made")).toHaveText("1");
    await expect(text(page, "runner-run-total")).toHaveText("Run total 4 of 6");
    await expect(page.getByTestId("runner-undo")).toBeEnabled();

    // End the run: back on the session with its total.
    await page.getByTestId("runner-end").click();
    await expect(page).toHaveURL(SESSION_URL);
    await expect(page.getByTestId("session-run-1")).toContainText(title);
    await expect(page.getByTestId("session-run-total-1")).toHaveText("4 of 6");
    await expect(page.getByTestId("session-status")).toContainText("In progress");

    // Finish the session, and see it in the history.
    await expect(page.locator('[data-hydrated="true"]:has([data-testid="session-finish"])')).toBeVisible();
    await page.getByTestId("session-finish").click();
    await expect(page.getByTestId("session-status")).toContainText("Finished");
    await expect(page.getByTestId("session-finish")).toHaveCount(0);
    await expect(page.getByTestId("session-run-open-1")).toHaveText("View");

    await page.goto("/sessions");
    await expect(page.getByTestId("session-open")).toHaveCount(0);
    await expect(page.getByTestId("session-list").getByRole("link").first()).toBeVisible();
  });

  test("a finished session's run is read-only", async ({ page, request }) => {
    const drillId = await createDrillViaApi(request, uniqueTitle("readonly"));
    await startRunFromDrill(page, drillId);
    await page.getByTestId("runner-outcome-success").click();
    await expect(page.getByTestId("runner-undo")).toBeEnabled();
    await page.getByTestId("runner-end").click();
    await expect(page).toHaveURL(SESSION_URL);

    await page.getByTestId("session-run-open-1").click();

    await expect(page).toHaveURL(RUN_URL);
    await expect(page.getByTestId("runner-ended")).toBeVisible();
    await expect(page.getByTestId("runner-outcome-success")).toBeDisabled();
    await expect(page.getByTestId("runner-end")).toHaveCount(0);
    await expect(text(page, "runner-taken")).toHaveText("/1");
  });

  test("a second drill run joins the same session through the drill picker", async ({
    page,
    request,
  }) => {
    const first = await createDrillViaApi(request, uniqueTitle("first"));
    const secondTitle = uniqueTitle("second");
    await createDrillViaApi(request, secondTitle);

    await startRunFromDrill(page, first);
    const sessionId = RUN_URL.exec(page.url())![1];
    await page.getByTestId("runner-outcome-success").click();
    await expect(page.getByTestId("runner-undo")).toBeEnabled();
    await page.getByTestId("runner-end").click();
    await expect(page).toHaveURL(SESSION_URL);

    await expect(page.getByTestId("drill-picker")).toHaveAttribute("data-hydrated", "true");
    await page.getByTestId("drill-picker-search").fill(secondTitle);
    await page.locator('[data-testid^="drill-picker-start-"]').first().click();

    await expect(page).toHaveURL(RUN_URL);
    expect(RUN_URL.exec(page.url())![1]).toBe(sessionId);
    await expect(text(page, "runner-title")).toHaveText(secondTitle);
    await page.getByTestId("runner-end").click();
    await expect(page).toHaveURL(SESSION_URL);
    await expect(page.getByTestId("session-run-2")).toContainText(secondTitle);
  });

  test("an archived drill cannot be started", async ({ page, request }) => {
    const drillId = await createDrillViaApi(request, uniqueTitle("archived"));
    await archiveDrillViaApi(request, drillId);

    await page.goto(`/drills/${drillId}`);

    await expect(page.getByTestId("drill-detail-start-run")).toBeDisabled();
    await expect(page.getByTestId("drill-detail-start-run-hint")).toContainText("Unarchive it first");
  });

  test("points drills take points and timed drills take a time", async ({ page, request }) => {
    const points = await createDrillViaApi(request, uniqueTitle("points"), {
      schema_version: 1,
      kind: "points",
      attempts_per_set: 3,
      max_points_per_attempt: 3,
      pass_threshold: 6,
    });
    await startRunFromDrill(page, points);
    await expect(page.getByTestId("runner-outcome-success")).toHaveCount(0);
    await page.getByTestId("runner-points-3").click();
    await expect(text(page, "runner-made")).toHaveText("3");
    await expect(text(page, "runner-taken")).toHaveText("/9");
    await expect(text(page, "runner-status")).toHaveText("3 more points to pass");
    await page.getByTestId("runner-end").click();
    await expect(page).toHaveURL(SESSION_URL);

    const timed = await createDrillViaApi(request, uniqueTitle("timed"), {
      schema_version: 1,
      kind: "timed",
      attempts_per_set: 3,
      time_limit_seconds: 90,
      pass_threshold: 2,
    });
    await startRunFromDrill(page, timed);
    await expect(page.getByTestId("runner-outcome-success")).toBeDisabled();
    await page.getByTestId("runner-seconds").fill("12.5");
    await page.getByTestId("runner-outcome-success").click();
    await expect(text(page, "runner-made")).toHaveText("1");
    await expect(page.getByTestId("runner-seconds")).toHaveValue("");
  });

  test("the sessions screen shows a session in progress with a way back to it", async ({
    page,
    request,
  }) => {
    const drillId = await createDrillViaApi(request, uniqueTitle("resume"));
    await startRunFromDrill(page, drillId);

    await page.goto("/sessions");
    await expect(page.getByTestId("session-open")).toBeVisible();
    await page.getByTestId("session-resume").click();

    await expect(page).toHaveURL(SESSION_URL);
    await expect(page.getByTestId("session-run-open-1")).toHaveText("Resume");
    await page.getByTestId("session-run-open-1").click();
    await expect(page).toHaveURL(RUN_URL);
  });

  test("shows a not-found screen for a run that does not exist", async ({ page }) => {
    await page.goto(
      "/sessions/00000000-0000-4000-8000-000000000000/runs/00000000-0000-4000-8000-000000000001",
    );
    await expect(page.getByTestId("session-not-found")).toBeVisible();
  });
});

test.describe("session runner on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("fits the screen, with big buttons for the outcomes", async ({ page, request }) => {
    const drillId = await createDrillViaApi(request, uniqueTitle("phone"));
    await startRunFromDrill(page, drillId);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const height = (id: string) =>
      page.getByTestId(id).evaluate((element) => element.getBoundingClientRect().height);
    expect(await height("runner-outcome-success")).toBeGreaterThanOrEqual(100);
    expect(await height("runner-outcome-fail")).toBeGreaterThanOrEqual(100);
    expect(await height("runner-outcome-partial")).toBeGreaterThanOrEqual(44);
    expect(await height("runner-undo")).toBeGreaterThanOrEqual(44);
    expect(await height("runner-end")).toBeGreaterThanOrEqual(44);

    await page.getByTestId("runner-outcome-success").tap();
    await expect(text(page, "runner-made")).toHaveText("1");
  });
});
