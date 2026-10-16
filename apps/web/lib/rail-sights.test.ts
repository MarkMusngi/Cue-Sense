import { describe, expect, it } from "vitest";

import { describeRailSights } from "@/lib/rail-sights";

describe("describeRailSights", () => {
  it("counts each kind of mark", () => {
    expect(
      describeRailSights(["success", "success", "fail", "partial", "empty", "empty"]),
    ).toBe("2 made, 1 missed, 1 partial, 2 to go");
  });

  it("mentions attempts still being saved", () => {
    expect(describeRailSights(["success", "pending", "empty"])).toBe(
      "1 made, 1 being saved, 1 to go",
    );
  });

  it("leaves out kinds that do not appear", () => {
    expect(describeRailSights(["empty", "empty", "empty"])).toBe("3 to go");
    expect(describeRailSights(["fail"])).toBe("1 missed");
  });

  it("describes an empty set", () => {
    expect(describeRailSights([])).toBe("No attempts");
  });
});
