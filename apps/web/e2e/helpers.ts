import { expect, type Locator, type Page } from "@playwright/test";

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

/** Open a page that holds the table editor and wait until React has hydrated it. */
export async function openEditorPage(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("table-editor")).toHaveAttribute("data-hydrated", "true");
}
