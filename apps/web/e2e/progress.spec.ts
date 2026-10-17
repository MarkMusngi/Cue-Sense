import { expect, test, type APIRequestContext } from "@playwright/test";

import { endOpenSession } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

/** A drill with a unique tag and `outcomes` logged in one finished session. */
async function seedPractice(request: APIRequestContext, outcomes: string[]) {
  const stamp = Date.now();
  const tag = await request.post(`${API_URL}/tags`, { data: { name: `E2E tag ${stamp}`, category: "custom" } });
  expect(tag.ok()).toBe(true);
  const tagId = ((await tag.json()) as { id: string }).id;
  const drill = await request.post(`${API_URL}/drills`, {
    data: {
      title: `Aaa progress ${stamp}`,
      difficulty: 2,
      tag_ids: [tagId],
      instructions: "Pocket the ball.",
      layout: {
        schema_version: 2,
        table: { kind: "pool", size_ft: 9 },
        cue_ball: { id: "ball_0", x: 2, y: 2 },
        object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
      },
      scoring: { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 6 },
    },
  });
  expect(drill.ok()).toBe(true);
  const drillId = ((await drill.json()) as { id: string }).id;

  await endOpenSession(request);
  const session = (await (await request.post(`${API_URL}/practice-sessions`, { data: {} })).json()) as { id: string };
  const run = (await (
    await request.post(`${API_URL}/practice-sessions/${session.id}/drill-runs`, { data: { drill_id: drillId } })
  ).json()) as { id: string };
  for (const outcome of outcomes) {
    const response = await request.post(`${API_URL}/drill-runs/${run.id}/attempts`, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: { outcome },
    });
    expect(response.ok()).toBe(true);
  }
  await request.patch(`${API_URL}/practice-sessions/${session.id}`, {
    data: { ended_at: new Date().toISOString() },
  });
  return { drillId, tagName: `E2E tag ${stamp}` };
}

test("shows a drill's success rate, weekly volume and tags after practice", async ({ page, request }) => {
  const { drillId, tagName } = await seedPractice(request, ["success", "fail", "success", "success"]);

  await page.goto(`/progress?range=30&drill=${drillId}`);

  await expect(page.getByTestId("success-chart")).toBeVisible();
  await expect(page.getByTestId("success-chart-point")).toHaveCount(1);
  // Four attempts is fewer than five, so the point is faded and the page says why.
  await expect(page.getByTestId("few-attempts-note")).toBeVisible();
  await expect(page.getByTestId("success-chart-table").getByRole("row").nth(1)).toContainText("475%");
  await expect(page.getByTestId("volume-bars")).toBeVisible();
  await expect(page.getByTestId("tag-table").getByRole("row", { name: new RegExp(tagName) })).toContainText("75%");
});

test("changing the range or the drill changes the page address", async ({ page, request }) => {
  const { drillId } = await seedPractice(request, ["success", "fail"]);

  await page.goto(`/progress?range=30&drill=${drillId}`);
  await expect(page.getByTestId("progress-range-30")).toHaveAttribute("aria-current", "true");

  await page.getByTestId("progress-range-7").click();

  await expect(page).toHaveURL(new RegExp(`range=7&drill=${drillId}`));
  await expect(page.getByTestId("progress-range-7")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("success-chart")).toBeVisible();
});

test("a drill with no attempts in the range says so", async ({ page, request }) => {
  const { drillId } = await seedPractice(request, ["success"]);
  const other = await request.post(`${API_URL}/drills`, {
    data: {
      title: `Aaa quiet ${Date.now()}`,
      difficulty: 1,
      tag_ids: [],
      instructions: "Pocket the ball.",
      layout: {
        schema_version: 2,
        table: { kind: "pool", size_ft: 9 },
        cue_ball: { id: "ball_0", x: 2, y: 2 },
        object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
      },
      scoring: { schema_version: 1, kind: "success_count", attempts_per_set: 5, pass_threshold: 3 },
    },
  });
  const quietId = ((await other.json()) as { id: string }).id;
  expect(quietId).not.toBe(drillId);

  await page.goto(`/progress?range=30&drill=${quietId}`);

  await expect(page.getByTestId("progress-success-empty")).toContainText("No attempts for this drill");
});

test.describe("a new account", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees empty states, not zeros or errors", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByTestId("auth-email").fill(`e2e-progress-${Date.now()}@example.test`);
    await page.getByTestId("auth-password").fill("a-long-test-password");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("sidebar-user-email")).toBeVisible();

    await page.goto("/progress");

    await expect(page.getByTestId("progress-success-empty")).toBeVisible();
    await expect(page.getByTestId("progress-volume-empty")).toBeVisible();
    await expect(page.getByTestId("progress-tags-empty")).toBeVisible();
    await expect(page.getByTestId("progress-volume-error")).toHaveCount(0);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("fits the screen", async ({ page, request }) => {
    const { drillId } = await seedPractice(request, ["success", "fail", "success", "success", "fail"]);

    await page.goto(`/progress?range=90&drill=${drillId}`);
    await expect(page.getByTestId("success-chart")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
