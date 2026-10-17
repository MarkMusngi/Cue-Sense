import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

/** Centre of a locator in page pixels. */
export async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A table position (diamond units) in page pixels; the drawing runs from -0.45 to 8.45. */
export async function tablePoint(page: Page, x: number, y: number) {
  const box = await page.getByTestId("table-editor-svg").boundingBox();
  if (!box) throw new Error("Table has no box");
  return {
    x: box.x + ((x + 0.45) / 8.9) * box.width,
    y: box.y + ((y + 0.45) / 4.9) * box.height,
  };
}

/** Wait for two animation frames, so style and touch-action changes have reached the compositor. */
export function nextFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

// Specs set up state through the API directly (Server Actions run on the Next server, so a
// browser route cannot stub them). The API is published on 8000 in compose and in CI.
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

type Scoring = Record<string, unknown>;

/** Finish the open practice session, if there is one, so each spec starts clean. */
export async function endOpenSession(request: APIRequestContext) {
  const response = await request.get(`${API_URL}/practice-sessions?limit=1`);
  const [latest] = ((await response.json()) as { items: { id: string; ended_at: string | null }[] }).items;
  if (latest && latest.ended_at === null) {
    await request.patch(`${API_URL}/practice-sessions/${latest.id}`, {
      data: { ended_at: new Date().toISOString() },
    });
  }
}

/** Create a drill with a small layout and the given scoring; returns its id. */
export async function createDrillViaApi(
  request: APIRequestContext,
  title: string,
  scoring: Scoring = { schema_version: 1, kind: "success_count", attempts_per_set: 5, pass_threshold: 3 },
) {
  const response = await request.post(`${API_URL}/drills`, {
    data: {
      title,
      difficulty: 2,
      tag_ids: [],
      instructions: "Pocket the ball.",
      layout: {
        schema_version: 2,
        table: { kind: "pool", size_ft: 9 },
        cue_ball: { id: "ball_0", x: 2, y: 2 },
        object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
      },
      scoring,
    },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { id: string }).id;
}

export async function archiveDrillViaApi(request: APIRequestContext, drillId: string) {
  const response = await request.patch(`${API_URL}/drills/${drillId}`, { data: { status: "archived" } });
  expect(response.ok()).toBe(true);
}

/** Open a page that holds the table editor and wait until React has hydrated it. */
export async function openEditorPage(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");
}
