import { expect, test, type Locator, type Page } from "@playwright/test";

type Layout = {
  cue_ball: { x: number; y: number };
  object_balls: { id: string; x: number; y: number }[];
  target_pocket?: string;
};

const PAGE = "/dev/table-editor";

/** Open the dev page and wait until React has hydrated, so clicks reach real handlers. */
async function openEditor(page: Page) {
  await page.goto(PAGE);
  await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");
}

/** Wait for two animation frames, so style and touch-action changes have reached the compositor. */
function nextFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function readLayout(page: Page): Promise<Layout> {
  return JSON.parse(await page.getByTestId("dev-table-editor-json").innerText()) as Layout;
}

/** Centre of a locator in page pixels. */
async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A table position (diamond units) in page pixels; the drawing runs from -0.45 to 8.45. */
async function tablePoint(page: Page, x: number, y: number) {
  const box = await page.getByTestId("table-editor-svg").boundingBox();
  if (!box) throw new Error("Table has no box");
  return {
    x: box.x + ((x + 0.45) / 8.9) * box.width,
    y: box.y + ((y + 0.45) / 4.9) * box.height,
  };
}

test.describe("table editor, mouse and keyboard", () => {
  test("places, nudges, drags, mirrors and undoes", async ({ page }) => {
    await openEditor(page);
    const start = await readLayout(page);
    expect(start.object_balls).toHaveLength(1);

    // Place a ball with the Ball tool.
    await page.getByTestId("table-editor-tool-ball").click();
    const spot = await tablePoint(page, 4, 3);
    await page.mouse.click(spot.x, spot.y);
    await expect(page.getByTestId("table-editor-selection")).toContainText("Ball 2");
    await expect.poll(async () => (await readLayout(page)).object_balls.length).toBe(2);
    const placed = (await readLayout(page)).object_balls[1];
    expect(placed.x).toBeCloseTo(4, 2);
    expect(placed.y).toBeCloseTo(3, 2);

    // Nudge with the keyboard, then undo the nudge.
    await page.getByTestId("table-editor-tool-select").click();
    await page.getByTestId("table-editor").getByTestId("table-editor-ball-2").focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await readLayout(page)).object_balls[1].x).toBeCloseTo(4.05, 3);
    await page.getByTestId("table-editor-undo").click();
    await expect.poll(async () => (await readLayout(page)).object_balls[1].x).toBeCloseTo(4, 3);

    // Drag ball 1 to a new spot: it snaps to the 0.05 grid.
    const from = await centre(page.getByTestId("table-editor").getByTestId("table-editor-ball-1"));
    const to = await tablePoint(page, 6.5, 1.5);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => {
        const ball = (await readLayout(page)).object_balls[0];
        return [ball.x, ball.y];
      })
      .toEqual([6.5, 1.5]);

    // Mirror horizontally: the cue ball swaps ends of the table.
    await page.getByTestId("table-editor-mirror-h").click();
    await expect.poll(async () => (await readLayout(page)).cue_ball.x).toBeCloseTo(6, 3);

    // Reset returns to the starting layout.
    await page.getByTestId("table-editor-reset").click();
    await expect.poll(() => readLayout(page)).toEqual(start);
  });

  test("keeps a dragged ball from overlapping another", async ({ page }) => {
    await openEditor(page);
    const from = await centre(page.getByTestId("table-editor").getByTestId("table-editor-ball-1"));
    // Drop it right on top of the cue ball.
    const onCue = await tablePoint(page, 2, 2);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(onCue.x, onCue.y, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const { cue_ball, object_balls } = await readLayout(page);
        const [ball] = object_balls;
        return Math.hypot(ball.x - cue_ball.x, ball.y - cue_ball.y);
      })
      .toBeGreaterThanOrEqual(0.178);
  });

  test("reaches every control from the keyboard", async ({ page }) => {
    await openEditor(page);
    await page.getByTestId("table-editor-pocket-top-right").focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await readLayout(page)).target_pocket).toBe("top_right");

    await page.getByTestId("table-editor-tool-ball").click();
    await page.getByTestId("table-editor-place").focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await readLayout(page)).object_balls.length).toBe(2);

    await page.keyboard.press("Delete");
    await expect.poll(async () => (await readLayout(page)).object_balls.length).toBe(1);
  });

  test("shows the same table read-only, with nothing to tab to", async ({ page }) => {
    await openEditor(page);
    const readonly = page.getByTestId("dev-table-editor-readonly");
    await expect(readonly.getByTestId("table-editor-readonly")).toBeVisible();
    await expect(readonly.locator("[tabindex]")).toHaveCount(0);
  });
});

test.describe("table editor on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("swiping scrolls the page until a ball is selected, then drags it", async ({
    page,
  }) => {
    await openEditor(page);
    // Playwright can only tap, so drive real touch swipes through the browser's input layer.
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (x: number, y: number) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let step = 1; step <= 12; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - step * 14 }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const scrollTop = () => page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

    // Empty felt: nothing there, so the browser pans the page.
    const felt = await tablePoint(page, 4, 3.4);
    expect(await scrollTop()).toBe(0);
    await swipe(felt.x, felt.y);
    await expect.poll(scrollTop).toBeGreaterThan(40);

    // Tap a ball to select it: now the table stops panning, so a touch drag moves it.
    await page.evaluate(() => window.scrollTo(0, 0));
    const ball = await centre(page.getByTestId("table-editor").getByTestId("table-editor-ball-1"));
    const before = (await readLayout(page)).object_balls[0];
    await page.touchscreen.tap(ball.x, ball.y);
    await expect(page.getByTestId("table-editor-selection")).toContainText("Ball 1");
    // The browser learns the new touch-action on its next frames; a person takes longer
    // than that between a tap and a drag, but a scripted swipe does not.
    await nextFrames(page);
    await swipe(ball.x, ball.y);
    await expect.poll(async () => (await readLayout(page)).object_balls[0].y).toBeLessThan(before.y);
    // A swipe that panned the page would move it by about 150 px.
    expect(await scrollTop()).toBeLessThan(20);

    // Tapping the felt deselects, and a swipe scrolls the page again.
    await page.touchscreen.tap(felt.x, felt.y);
    await expect(page.getByTestId("table-editor-selection")).toContainText("Nothing selected");
    await nextFrames(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await swipe(felt.x, felt.y);
    await expect.poll(scrollTop).toBeGreaterThan(40);
  });

  test("fits the screen and works by tapping", async ({ page }) => {
    await openEditor(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const ball = await centre(page.getByTestId("table-editor").getByTestId("table-editor-ball-1"));
    await page.touchscreen.tap(ball.x, ball.y);
    await expect(page.getByTestId("table-editor-selection")).toContainText("Ball 1");

    // Every button is at least 44 px tall.
    const heights = await page
      .getByTestId("table-editor")
      .locator("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);

    await page.getByTestId("table-editor-tool-pocket").click();
    const pocket = await centre(page.getByTestId("table-editor-pocket-bottom-right"));
    await page.touchscreen.tap(pocket.x, pocket.y);
    await expect.poll(async () => (await readLayout(page)).target_pocket).toBe("bottom_right");
  });
});
