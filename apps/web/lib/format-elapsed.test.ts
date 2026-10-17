import { describe, expect, it } from "vitest";

import { formatElapsed, parseSeconds } from "@/lib/format-elapsed";

describe("formatElapsed", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [1000, "0:01"],
    [42 * 60_000 + 15_000, "42:15"],
    [59 * 60_000 + 59_000, "59:59"],
    [3_600_000, "1:00:00"],
    [3_600_000 + 2 * 60_000 + 15_000, "1:02:15"],
    [-5000, "0:00"],
    [Number.NaN, "0:00"],
  ])("writes %i ms as %s", (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });
});

describe("parseSeconds", () => {
  it.each([
    ["12", 12_000],
    ["12.5", 12_500],
    [" 0 ", 0],
    ["0.004", 4],
  ])("reads %j as %i ms", (text, ms) => {
    expect(parseSeconds(text)).toBe(ms);
  });

  it.each(["", "abc", "-1", "1,5", "1e3", ".5", "5."])("rejects %j", (text) => {
    expect(parseSeconds(text)).toBeNull();
  });
});
