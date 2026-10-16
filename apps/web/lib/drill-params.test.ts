import { describe, expect, it } from "vitest";

import { readLibraryParams } from "./drill-params";

const TAG_ID = "3c2e5a10-8f3b-4c1d-9a77-0b6f2d1e4a55";

describe("readLibraryParams", () => {
  it("keeps valid values and trims the search", () => {
    expect(
      readLibraryParams({
        status: "active",
        difficulty: "3",
        tag_id: TAG_ID,
        search: " cut ",
        sort: "difficulty",
      }),
    ).toEqual({
      status: "active",
      difficulty: "3",
      tag_id: TAG_ID,
      search: "cut",
      sort: "difficulty",
    });
  });

  it("drops values the API would reject", () => {
    const result = readLibraryParams({
      status: "gone",
      difficulty: "abc",
      tag_id: "not-a-uuid",
      search: "   ",
      sort: "random",
    });

    expect(result).toEqual({
      status: undefined,
      difficulty: undefined,
      tag_id: undefined,
      search: undefined,
      sort: undefined,
    });
  });

  it("rejects a difficulty outside 1 to 5", () => {
    expect(readLibraryParams({ difficulty: "9" }).difficulty).toBeUndefined();
    expect(readLibraryParams({ difficulty: "0" }).difficulty).toBeUndefined();
    expect(readLibraryParams({ difficulty: "NaN" }).difficulty).toBeUndefined();
  });

  it("drops a search longer than 100 characters", () => {
    expect(readLibraryParams({ search: "a".repeat(101) }).search).toBeUndefined();
    expect(readLibraryParams({ search: "a".repeat(100) }).search).toHaveLength(100);
  });

  it("uses the first value when a parameter repeats", () => {
    expect(readLibraryParams({ difficulty: ["2", "4"] }).difficulty).toBe("2");
  });
});
