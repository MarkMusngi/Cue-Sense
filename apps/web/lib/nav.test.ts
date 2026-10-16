import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isActive } from "@/lib/nav";

describe("NAV_ITEMS", () => {
  it("lists the three sections in order", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/drills", "/sessions", "/progress"]);
  });
});

describe("isActive", () => {
  it("matches the section and the pages inside it", () => {
    expect(isActive("/drills", "/drills")).toBe(true);
    expect(isActive("/drills/abc", "/drills")).toBe(true);
  });

  it("does not match other sections or prefixes of other words", () => {
    expect(isActive("/progress", "/drills")).toBe(false);
    expect(isActive("/drills-archive", "/drills")).toBe(false);
    expect(isActive("/", "/drills")).toBe(false);
  });
});
