// Theme choice: a stored choice wins, then the system preference, then dark (the
// "Night hall" default). The root layout inlines themeScript so the right theme is set
// before the first paint, with no flash of the wrong one.

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "cue-sense-theme";

export function resolveTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return prefersLight ? "light" : "dark";
}

/** Sets the theme on <html> and remembers it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this page.
  }
}

// Plain ES5 so it runs before any bundle loads. Mirrors resolveTheme; theme.test.ts
// runs this exact string to keep the two in step.
export const themeScript = `(function () {
  var theme = "dark";
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      theme = "light";
    }
  } catch (error) {
    theme = "dark";
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;
