// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY, resolveTheme, themeScript } from "@/lib/theme";

describe("resolveTheme", () => {
  it("uses a stored choice first", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("falls back to the system preference, then dark", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe("dark");
    expect(resolveTheme("purple", false)).toBe("dark");
  });
});

describe("themeScript", () => {
  function stubSystemLight(isLight: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: isLight && query.includes("light") })),
    );
  }

  function runScript() {
    // The same string the root layout inlines before the page renders.
    new Function(themeScript)();
    return document.documentElement.dataset.theme;
  }

  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies the stored theme", () => {
    stubSystemLight(true);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    expect(runScript()).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("follows the system preference when nothing is stored", () => {
    stubSystemLight(true);

    expect(runScript()).toBe("light");
  });

  it("defaults to dark", () => {
    stubSystemLight(false);

    expect(runScript()).toBe("dark");
  });

  it("falls back to dark when storage throws", () => {
    stubSystemLight(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(runScript()).toBe("dark");
  });
});
