import { describe, expect, it } from "vitest";

import type { ApiErrorDetail, DrillLayout } from "@/lib/api-client";
import { fieldKeyForPath, formatPath, problemsFromDetails } from "@/lib/drill-problems";

const LAYOUT: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [
    { id: "ball_1", x: 5.5, y: 1.2 },
    { id: "ball_4", x: 5.55, y: 1.25 },
  ],
};

function detail(code: string, path: ApiErrorDetail["path"], message = "msg"): ApiErrorDetail {
  return { code, message, path };
}

describe("formatPath", () => {
  it("writes keys with dots and indexes in brackets", () => {
    expect(formatPath(["layout", "object_balls", 1])).toBe("layout.object_balls[1]");
    expect(formatPath(["scoring", "pass_threshold"])).toBe("scoring.pass_threshold");
    expect(formatPath([])).toBe("");
  });
});

describe("fieldKeyForPath", () => {
  it.each<[ApiErrorDetail["path"], string]>([
    [["title"], "title"],
    [["description"], "description"],
    [["difficulty"], "difficulty"],
    [["instructions"], "instructions"],
    [["tag_ids", 0], "tags"],
    [["layout", "object_balls", 1], "ball:ball_4"],
    [["layout", "object_balls", 9], "layout"],
    [["layout", "cue_ball", "x"], "ball:ball_0"],
    [["layout", "landing_zone"], "layout"],
    [["scoring", "pass_threshold"], "scoring.pass_threshold"],
    [["scoring"], "scoring"],
    [["something_else"], "form"],
  ])("maps %j to %s", (path, key) => {
    expect(fieldKeyForPath(path, LAYOUT)).toBe(key);
  });
});

describe("problemsFromDetails", () => {
  it("names the ball for an overlap and offers it to select", () => {
    const [problem] = problemsFromDetails(
      [detail("balls_overlap", ["layout", "object_balls", 1])],
      LAYOUT,
    );

    expect(problem).toEqual({
      key: "ball:ball_4",
      message: "Ball 4 overlaps another ball.",
      code: "balls_overlap",
      path: "layout.object_balls[1]",
      ball_id: "ball_4",
    });
  });

  it("explains the layout codes in words", () => {
    const messages = problemsFromDetails(
      [
        detail("ball_out_of_bounds", ["layout", "cue_ball"]),
        detail("too_many_object_balls", ["layout", "object_balls"]),
        detail("position_out_of_bounds", ["layout", "landing_zone"]),
      ],
      LAYOUT,
    ).map((p) => p.message);

    expect(messages).toEqual([
      "Cue ball is not fully on the table.",
      "A drill can have at most 15 object balls.",
      "The landing zone is not on the table.",
    ]);
  });

  it("uses the field's own name for a pass threshold that is too high", () => {
    const [problem] = problemsFromDetails(
      [
        detail(
          "pass_threshold_too_high",
          ["scoring", "pass_threshold"],
          "pass_threshold can be at most 10.",
        ),
      ],
      LAYOUT,
    );

    expect(problem.key).toBe("scoring.pass_threshold");
    expect(problem.message).toBe("Makes to pass can be at most 10.");
    expect(problem.ball_id).toBeUndefined();
  });

  it("gives schema errors a plain message for text fields and scoring numbers", () => {
    const problems = problemsFromDetails(
      [
        detail("schema_invalid", ["title"], "String should have at least 1 character"),
        detail("schema_invalid", ["scoring", "attempts_per_set"], "Input should be >= 1"),
      ],
      LAYOUT,
    );

    expect(problems[0].message).toBe("Enter a title of up to 200 characters.");
    expect(problems[1].message).toBe("Attempts per set: enter a whole number of 1 or more.");
  });

  it("falls back to the API's own message for anything unknown", () => {
    const [problem] = problemsFromDetails(
      [detail("odd_code", ["nowhere"], "Something odd.")],
      LAYOUT,
    );

    expect(problem.key).toBe("form");
    expect(problem.message).toBe("Something odd.");
  });

  it("keeps the order the API gave", () => {
    const problems = problemsFromDetails(
      [detail("schema_invalid", ["instructions"]), detail("schema_invalid", ["title"])],
      LAYOUT,
    );
    expect(problems.map((p) => p.key)).toEqual(["instructions", "title"]);
  });
});
