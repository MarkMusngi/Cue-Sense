import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { composite, contrastRatio } from "@/lib/contrast";

// Reads the real tokens from globals.css, so this checks what ships.
const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function themeTokens(theme: "dark" | "light"): Record<string, string> {
  const block = new RegExp(`\\[data-theme="${theme}"\\][^{]*\\{([^}]*)\\}`).exec(css);
  if (!block) {
    throw new Error(`No [data-theme="${theme}"] block in globals.css`);
  }
  const tokens: Record<string, string> = {};
  for (const match of block[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

// [foreground, background, minimum ratio, what it is]
const TEXT_PAIRS: [string, string, number, string][] = [
  ["text", "bg", 4.5, "body text on the page"],
  ["text", "surface", 4.5, "body text on cards"],
  ["text", "raised", 4.5, "text on raised controls"],
  ["muted", "bg", 4.5, "secondary text on the page"],
  ["muted", "surface", 4.5, "secondary text on cards"],
  ["muted", "raised", 4.5, "secondary text on raised controls"],
  ["chalk", "bg", 4.5, "links and selected text on the page"],
  ["chalk", "surface", 4.5, "links and selected text on cards"],
  ["chalk-ink", "chalk", 4.5, "primary and Make button labels"],
  ["chalk", "chalk-soft@surface", 4.5, "selected chip text"],
  ["text", "chalk-soft@surface", 4.5, "active sidebar item"],
  ["miss", "surface", 4.5, "miss and error text on cards"],
  ["miss", "miss-soft@surface", 4.5, "Miss button label"],
  ["miss", "bg", 4.5, "error text on the page"],
];

// Non-text UI that must be seen (WCAG 1.4.11).
const UI_PAIRS: [string, string, number, string][] = [
  ["control", "surface", 3, "input and toggle borders on cards"],
  ["control", "bg", 3, "input and toggle borders on the page"],
  ["focus", "bg", 3, "focus ring on the page"],
  ["focus", "surface", 3, "focus ring on cards"],
  ["part", "surface", 3, "partial rail sight"],
  ["chalk", "surface", 3, "made rail sight"],
];

function resolve(tokens: Record<string, string>, name: string): string {
  // "chalk-soft@surface" means the translucent token laid over an opaque one.
  const [top, under] = name.split("@");
  return under ? composite(tokens[top], tokens[under]) : tokens[top];
}

describe.each(["dark", "light"] as const)("%s theme", (theme) => {
  const tokens = themeTokens(theme);

  it.each([...TEXT_PAIRS, ...UI_PAIRS])("%s on %s is at least %s:1 (%s)", (fg, bg, min) => {
    expect(tokens[fg.split("@")[0]], `token --${fg}`).toBeDefined();
    expect(contrastRatio(resolve(tokens, fg), resolve(tokens, bg))).toBeGreaterThanOrEqual(min);
  });
});
