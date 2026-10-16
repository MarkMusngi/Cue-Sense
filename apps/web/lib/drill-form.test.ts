import { describe, expect, it } from "vitest";

import type { DrillRead, DrillScoring } from "@/lib/api-client";
import {
  canonical,
  emptyForm,
  formFromDrill,
  isDirty,
  maxPassThreshold,
  parsePositiveInt,
  readsAs,
  scoringFromForm,
  toContent,
  validateForm,
  willCreateVersion,
} from "@/lib/drill-form";

function drillWith(scoring: DrillScoring): DrillRead {
  return {
    id: "d1",
    title: "30-degree cut",
    slug: "30-degree-cut",
    description: "A cut from the foot spot.",
    difficulty: 2,
    status: "active",
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
    tags: [
      { id: "t1", name: "Cut shots", category: "skill", created_at: "2026-10-01T10:00:00Z" },
      { id: "t2", name: "Aim", category: "skill", created_at: "2026-10-01T10:00:00Z" },
    ],
    current_version: {
      id: "v2",
      version_number: 2,
      instructions: "Cut the 1 ball into the corner.",
      layout: emptyForm().layout,
      scoring,
      created_at: "2026-10-12T10:00:00Z",
    },
  };
}

const MAKE_6_OF_10: DrillScoring = {
  schema_version: 1,
  kind: "success_count",
  attempts_per_set: 10,
  pass_threshold: 6,
};

describe("parsePositiveInt", () => {
  it.each([
    ["7", 7],
    [" 12 ", 12],
    ["1", 1],
  ])("reads %j as %i", (text, value) => {
    expect(parsePositiveInt(text)).toBe(value);
  });

  it.each(["", "0", "-3", "7.5", "1e3", "ten", "7 8"])("rejects %j", (text) => {
    expect(parsePositiveInt(text)).toBeNull();
  });
});

describe("formFromDrill", () => {
  it.each<DrillScoring>([
    MAKE_6_OF_10,
    { schema_version: 1, kind: "streak", streak_length: 5 },
    {
      schema_version: 1,
      kind: "points",
      attempts_per_set: 10,
      max_points_per_attempt: 3,
      pass_threshold: 20,
    },
    {
      schema_version: 1,
      kind: "timed",
      attempts_per_set: 5,
      time_limit_seconds: 120,
      pass_threshold: 4,
    },
  ])("round-trips %j through the form", (scoring) => {
    const form = formFromDrill(drillWith(scoring));

    expect(form.scoring_kind).toBe(scoring.kind);
    expect(scoringFromForm(form)).toEqual(scoring);
    expect(validateForm(form)).toEqual([]);
  });

  it("carries the drill's title, difficulty, tags, instructions and layout", () => {
    const form = formFromDrill(drillWith(MAKE_6_OF_10));

    expect(form.title).toBe("30-degree cut");
    expect(form.description).toBe("A cut from the foot spot.");
    expect(form.difficulty).toBe(2);
    expect(form.tag_ids).toEqual(["t1", "t2"]);
    expect(form.instructions).toBe("Cut the 1 ball into the corner.");
  });
});

describe("validateForm", () => {
  it("asks for a title and instructions on a new drill", () => {
    expect(validateForm(emptyForm()).map((p) => p.key)).toEqual(["title", "instructions"]);
  });

  it("flags every scoring number that is not a whole number of 1 or more", () => {
    const form = {
      ...emptyForm(),
      title: "x",
      instructions: "y",
      attempts_per_set: "0",
      pass_threshold: "abc",
    };

    const keys = validateForm(form).map((p) => p.key);

    expect(keys).toEqual(["scoring.attempts_per_set", "scoring.pass_threshold"]);
  });

  it("rejects a pass threshold above the attempts per set, and allows equal", () => {
    const base = { ...emptyForm(), title: "x", instructions: "y" };

    expect(validateForm({ ...base, pass_threshold: "11" })).toEqual([
      { key: "scoring.pass_threshold", message: "At most 10, the attempts per set." },
    ]);
    expect(validateForm({ ...base, pass_threshold: "10" })).toEqual([]);
  });

  it("limits points by attempts times the most points per attempt", () => {
    const base = {
      ...emptyForm(),
      title: "x",
      instructions: "y",
      scoring_kind: "points" as const,
      attempts_per_set: "10",
      max_points_per_attempt: "3",
    };

    expect(maxPassThreshold({ ...base, pass_threshold: "30" })).toBe(30);
    expect(validateForm({ ...base, pass_threshold: "30" })).toEqual([]);
    expect(validateForm({ ...base, pass_threshold: "31" })[0].message).toMatch(/At most 30/);
  });

  it("only checks the fields of the chosen rule", () => {
    const form = {
      ...emptyForm(),
      title: "x",
      instructions: "y",
      scoring_kind: "streak" as const,
      attempts_per_set: "garbage",
      streak_length: "5",
    };

    expect(validateForm(form)).toEqual([]);
  });

  it("rejects a title that is too long", () => {
    const form = { ...emptyForm(), title: "a".repeat(201), instructions: "y" };
    expect(validateForm(form)[0].key).toBe("title");
  });
});

describe("toContent", () => {
  it("trims text and sends an empty description as null", () => {
    const form = {
      ...emptyForm(),
      title: "  Stop shot ",
      description: "   ",
      instructions: " Roll back. ",
    };

    const content = toContent(form);

    expect(content.title).toBe("Stop shot");
    expect(content.description).toBeNull();
    expect(content.instructions).toBe("Roll back.");
    expect(content.scoring).toEqual({
      schema_version: 1,
      kind: "success_count",
      attempts_per_set: 10,
      pass_threshold: 7,
    });
  });

  it("refuses a form whose scoring is not valid", () => {
    expect(() => toContent({ ...emptyForm(), attempts_per_set: "" })).toThrow();
  });
});

describe("willCreateVersion", () => {
  const drill = drillWith(MAKE_6_OF_10);
  const version = drill.current_version!;

  it("is false when only the title, description, difficulty or tags changed", () => {
    const form = {
      ...formFromDrill(drill),
      title: "Renamed",
      description: "New words",
      difficulty: 5,
      tag_ids: ["t1"],
    };

    expect(willCreateVersion(form, version)).toBe(false);
  });

  it("is false for the same layout with its keys in another order", () => {
    const form = formFromDrill(drill);
    const { object_balls, cue_ball, table, schema_version } = form.layout;
    const reordered = { ...form, layout: { object_balls, cue_ball, table, schema_version } };

    expect(willCreateVersion(reordered, version)).toBe(false);
  });

  it("is true when a ball moved", () => {
    const form = formFromDrill(drill);
    const moved = {
      ...form,
      layout: { ...form.layout, cue_ball: { ...form.layout.cue_ball, x: 2.05 } },
    };

    expect(willCreateVersion(moved, version)).toBe(true);
  });

  it("is true when the instructions changed, but not for surrounding whitespace", () => {
    const form = formFromDrill(drill);

    expect(willCreateVersion({ ...form, instructions: "Something else." }, version)).toBe(true);
    expect(willCreateVersion({ ...form, instructions: ` ${form.instructions} ` }, version)).toBe(
      false,
    );
  });

  it("is true when the scoring changed, or is not valid yet", () => {
    const form = formFromDrill(drill);

    expect(willCreateVersion({ ...form, pass_threshold: "7" }, version)).toBe(true);
    expect(willCreateVersion({ ...form, scoring_kind: "streak" }, version)).toBe(true);
    expect(willCreateVersion({ ...form, pass_threshold: "" }, version)).toBe(true);
  });
});

describe("isDirty and canonical", () => {
  it("compares forms by content", () => {
    const saved = formFromDrill(drillWith(MAKE_6_OF_10));

    expect(isDirty({ ...saved }, saved)).toBe(false);
    expect(isDirty({ ...saved, title: "Other" }, saved)).toBe(true);
  });

  it("ignores key order", () => {
    expect(canonical({ a: 1, b: { c: 2, d: 3 } })).toBe(canonical({ b: { d: 3, c: 2 }, a: 1 }));
  });
});

describe("readsAs", () => {
  it.each([
    [{}, "Reads as: make 7 of 10 per set."],
    [{ scoring_kind: "streak" as const }, "Reads as: make 5 in a row."],
    [
      { scoring_kind: "points" as const, pass_threshold: "20" },
      "Reads as: score 20 points per set of 10 attempts, up to 3 each.",
    ],
    [
      { scoring_kind: "timed" as const, pass_threshold: "4", attempts_per_set: "5" },
      "Reads as: make 4 of 5 within 120 seconds.",
    ],
  ])("describes %j", (change, text) => {
    expect(readsAs({ ...emptyForm(), ...change })).toBe(text);
  });
});
