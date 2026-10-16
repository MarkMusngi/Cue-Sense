import { expect, test, type Page } from "@playwright/test";

import { openEditorPage, tablePoint } from "./helpers";

// These specs use the seeded API (docker compose up, then the seed script). Each one
// makes its own drill with a unique title, so reruns on the same database do not clash.

const DRILL_URL = /\/drills\/[0-9a-f-]{36}$/;

function uniqueTitle(label: string) {
  return `E2E ${label} ${Date.now()}`;
}

/** Create a drill through the editor and land on its detail screen. */
async function createDrill(page: Page, title: string, instructions = "Pot the ball cleanly.") {
  await openEditorPage(page, "/drills/new");
  await page.getByTestId("drill-editor-title").fill(title);
  await page.getByTestId("drill-editor-instructions").fill(instructions);
  await page.getByTestId("drill-editor-save").click();
  await expect(page).toHaveURL(DRILL_URL);
  await expect(page.getByTestId("drill-detail-title")).toHaveText(title);
}

test.describe("drill library", () => {
  test("links a card to its drill, and has a New drill button", async ({ page }) => {
    await page.goto("/drills");
    await expect(page.getByTestId("drill-new")).toHaveAttribute("href", "/drills/new");

    const card = page.getByTestId("drill-card").first();
    const title = (await card.getByTestId("drill-card-link").innerText()).trim();
    await card.getByTestId("drill-card-link").click();

    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-title")).toHaveText(title);
    await expect(page.getByTestId("drill-detail-instructions")).not.toBeEmpty();
    await expect(page.getByTestId("drill-detail-versions")).toBeVisible();
    await expect(page.getByTestId("drill-detail-edit")).toBeVisible();
  });

  test("shows a not-found screen for a drill that does not exist", async ({ page }) => {
    await page.goto("/drills/00000000-0000-4000-8000-000000000000");
    await expect(page.getByTestId("drill-not-found")).toBeVisible();
    await page.getByTestId("drill-not-found-back").click();
    await expect(page).toHaveURL(/\/drills$/);
  });
});

test.describe("drill editor", () => {
  test("creates a drill by placing balls and finds it in the library", async ({ page }) => {
    const title = uniqueTitle("create");
    await page.goto("/drills");
    await page.getByTestId("drill-new").click();
    await expect(page).toHaveURL(/\/drills\/new$/);
    await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");

    // Place a second object ball with the Ball tool.
    await page.getByTestId("table-editor-tool-ball").click();
    const spot = await tablePoint(page, 4, 3);
    await page.mouse.click(spot.x, spot.y);
    await expect(page.getByTestId("table-editor-selection")).toContainText("Ball 2");

    await page.getByTestId("drill-editor-title").fill(title);
    await page.getByTestId("drill-editor-difficulty-4").click();
    await page.getByTestId("drill-editor-instructions").fill("Pot the balls in order.");
    await page.getByTestId("drill-editor-save").click();

    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-title")).toHaveText(title);
    await expect(page.getByTestId("drill-detail-status")).toHaveText("Draft");
    await expect(page.getByTestId("drill-detail-version-1")).toBeVisible();
    // The cue ball and two object balls are drawn on the detail screen's table.
    await expect(
      page.getByTestId("table-editor-readonly").getByTestId(/^table-editor-ball-/),
    ).toHaveCount(3);

    await page.goto(`/drills?search=${encodeURIComponent(title)}`);
    await expect(page.getByTestId("drill-card")).toHaveCount(1);
  });

  test("shows what is missing instead of saving an empty drill", async ({ page }) => {
    await openEditorPage(page, "/drills/new");

    await page.getByTestId("drill-editor-save").click();

    await expect(page.getByTestId("drill-editor-problems")).toContainText("2 problems");
    await expect(page.getByTestId("drill-editor-title-error")).toHaveText("Enter a title.");
    await expect(page.getByTestId("drill-editor-title")).toBeFocused();
    await expect(page).toHaveURL(/\/drills\/new$/);

    await page.getByTestId("drill-editor-title").fill("x");
    await page.getByTestId("drill-editor-instructions").fill("y");
    await page.getByTestId("drill-editor-scoring-pass_threshold").fill("11");
    await expect(page.getByTestId("drill-editor-scoring-pass_threshold-error")).toHaveText(
      "At most 10, the attempts per set.",
    );
  });

  test("a changed layout or instructions creates version 2", async ({ page }) => {
    const title = uniqueTitle("version");
    await createDrill(page, title);

    await page.getByTestId("drill-detail-edit").click();
    await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByTestId("drill-editor-save")).toBeDisabled();

    await page.getByTestId("drill-editor-instructions").fill("A new way to pot the ball.");
    await expect(page.getByTestId("drill-editor-save")).toHaveText("Save v2");
    await page.getByTestId("drill-editor-save").click();

    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-instructions")).toHaveText(
      "A new way to pot the ball.",
    );
    await expect(page.getByTestId("drill-detail-version-2")).toContainText("current");
    await expect(page.getByTestId("drill-detail-version-1")).toBeVisible();
  });

  test("a new title alone does not create a version", async ({ page }) => {
    const title = uniqueTitle("title");
    await createDrill(page, title);

    await page.getByTestId("drill-detail-edit").click();
    await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");
    await page.getByTestId("drill-editor-title").fill(`${title} renamed`);
    await expect(page.getByTestId("drill-editor-save")).toHaveText("Save");
    await page.getByTestId("drill-editor-save").click();

    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-title")).toHaveText(`${title} renamed`);
    await expect(page.getByTestId("drill-detail-version-1")).toContainText("current");
    await expect(page.getByTestId("drill-detail-version-2")).toHaveCount(0);
  });

  test("a save from a stale page is refused, not overwritten", async ({ page, context }) => {
    const title = uniqueTitle("stale");
    await createDrill(page, title);
    const editUrl = `${page.url()}/edit`;

    // Two editors open on the same version.
    const other = await context.newPage();
    await openEditorPage(page, editUrl);
    await openEditorPage(other, editUrl);

    await page.getByTestId("drill-editor-instructions").fill("Saved first.");
    await page.getByTestId("drill-editor-save").click();
    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-version-2")).toBeVisible();

    await other.getByTestId("drill-editor-instructions").fill("Saved second, from a stale page.");
    await other.getByTestId("drill-editor-save").click();

    await expect(other.getByTestId("drill-editor-stale")).toBeVisible();
    await expect(other.getByTestId("drill-editor-instructions")).toHaveValue(
      "Saved second, from a stale page.",
    );
    await expect(other).toHaveURL(/\/edit$/);

    // The drill still has the first save.
    await page.reload();
    await expect(page.getByTestId("drill-detail-instructions")).toHaveText("Saved first.");
    await expect(page.getByTestId("drill-detail-version-3")).toHaveCount(0);
  });
});

test.describe("drill screens on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("the editor fits the screen and its settings are in tabs", async ({ page }) => {
    await openEditorPage(page, "/drills/new");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByTestId("drill-editor-tab-details")).toBeVisible();
    await expect(page.getByTestId("drill-editor-title")).toBeVisible();
    await expect(page.getByTestId("drill-editor-scoring-kind")).toBeHidden();

    await page.getByTestId("drill-editor-tab-scoring").click();
    await expect(page.getByTestId("drill-editor-scoring-kind")).toBeVisible();
    await expect(page.getByTestId("drill-editor-title")).toBeHidden();

    // A problem in another tab: Save opens the tab that holds it.
    await page.getByTestId("drill-editor-save").click();
    await expect(page.getByTestId("drill-editor-problems")).toBeVisible();
    await expect(page.getByTestId("drill-editor-title")).toBeFocused();
  });

  test("the detail screen fits the screen", async ({ page }) => {
    await page.goto("/drills");
    await page.getByTestId("drill-card-link").first().tap();
    await expect(page).toHaveURL(DRILL_URL);
    await expect(page.getByTestId("drill-detail-versions")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
