// The drill editor's form state and the rules around it (docs/architecture.md sections
// 4.4 and 4.5). Number inputs are kept as strings so a half-typed value is not lost;
// they are parsed in one place, here. No React.

import type {
  DrillContent,
  DrillLayout,
  DrillRead,
  DrillScoring,
  DrillVersionRead,
  ScoringKind,
} from "@/lib/api-client";

export const SCORING_SCHEMA_VERSION = 1;
export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 2000;
export const MAX_INSTRUCTIONS = 10_000;

export const SCORING_KINDS: { value: ScoringKind; label: string }[] = [
  { value: "success_count", label: "Make N of M per set" },
  { value: "streak", label: "Streak of N" },
  { value: "points", label: "Points per set" },
  { value: "timed", label: "Timed sets" },
];

export type DrillForm = {
  title: string;
  description: string;
  difficulty: number;
  tag_ids: string[];
  instructions: string;
  layout: DrillLayout;
  scoring_kind: ScoringKind;
  // Kept for every kind, so switching the rule and back loses nothing.
  attempts_per_set: string;
  pass_threshold: string;
  streak_length: string;
  max_points_per_attempt: string;
  time_limit_seconds: string;
};

/** A problem found before sending: key says which field, message what to do. */
export type FieldProblem = { key: string; message: string };

export const SCORING_FIELDS: Record<ScoringKind, (keyof DrillForm)[]> = {
  success_count: ["attempts_per_set", "pass_threshold"],
  streak: ["streak_length"],
  points: ["attempts_per_set", "max_points_per_attempt", "pass_threshold"],
  timed: ["attempts_per_set", "time_limit_seconds", "pass_threshold"],
};

export const SCORING_FIELD_LABELS: Record<string, string> = {
  attempts_per_set: "Attempts per set",
  pass_threshold: "Makes to pass",
  streak_length: "Streak length",
  max_points_per_attempt: "Most points per attempt",
  time_limit_seconds: "Time limit (seconds)",
};

const POINTS_THRESHOLD_LABEL = "Points to pass";

export function scoringFieldLabel(kind: ScoringKind, field: string): string {
  return kind === "points" && field === "pass_threshold"
    ? POINTS_THRESHOLD_LABEL
    : (SCORING_FIELD_LABELS[field] ?? field);
}

/** A new drill: the cue ball on the head string and one object ball, make 7 of 10. */
export function emptyForm(): DrillForm {
  return {
    title: "",
    description: "",
    difficulty: 3,
    tag_ids: [],
    instructions: "",
    layout: {
      schema_version: 2,
      table: { kind: "pool", size_ft: 9 },
      cue_ball: { id: "ball_0", x: 2, y: 2 },
      object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
    },
    scoring_kind: "success_count",
    attempts_per_set: "10",
    pass_threshold: "7",
    streak_length: "5",
    max_points_per_attempt: "3",
    time_limit_seconds: "120",
  };
}

/** The form for editing a drill's current version. */
export function formFromDrill(drill: DrillRead): DrillForm {
  const version = drill.current_version;
  const form = { ...emptyForm(), title: drill.title, description: drill.description ?? "" };
  form.difficulty = drill.difficulty;
  form.tag_ids = drill.tags.map((tag) => tag.id);
  if (!version) return form;
  form.instructions = version.instructions;
  form.layout = version.layout;
  const scoring = version.scoring;
  form.scoring_kind = scoring.kind;
  switch (scoring.kind) {
    case "success_count":
      form.attempts_per_set = String(scoring.attempts_per_set);
      form.pass_threshold = String(scoring.pass_threshold);
      break;
    case "streak":
      form.streak_length = String(scoring.streak_length);
      break;
    case "points":
      form.attempts_per_set = String(scoring.attempts_per_set);
      form.max_points_per_attempt = String(scoring.max_points_per_attempt);
      form.pass_threshold = String(scoring.pass_threshold);
      break;
    case "timed":
      form.attempts_per_set = String(scoring.attempts_per_set);
      form.time_limit_seconds = String(scoring.time_limit_seconds);
      form.pass_threshold = String(scoring.pass_threshold);
      break;
  }
  return form;
}

/** A whole number of 1 or more from an input, or null. */
export function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function numbersFor(form: DrillForm): Partial<Record<keyof DrillForm, number | null>> {
  const numbers: Partial<Record<keyof DrillForm, number | null>> = {};
  for (const field of SCORING_FIELDS[form.scoring_kind]) {
    numbers[field] = parsePositiveInt(String(form[field]));
  }
  return numbers;
}

/** The most "Makes to pass" can be, which depends on the rule. */
export function maxPassThreshold(form: DrillForm): number | null {
  const attempts = parsePositiveInt(form.attempts_per_set);
  if (attempts === null) return null;
  if (form.scoring_kind === "points") {
    const most = parsePositiveInt(form.max_points_per_attempt);
    return most === null ? null : attempts * most;
  }
  return attempts;
}

/** The scoring JSON for the form, or null while any of its numbers is not valid. */
export function scoringFromForm(form: DrillForm): DrillScoring | null {
  const n = numbersFor(form);
  const base = { schema_version: SCORING_SCHEMA_VERSION };
  switch (form.scoring_kind) {
    case "success_count":
      return n.attempts_per_set && n.pass_threshold
        ? { ...base, kind: "success_count", attempts_per_set: n.attempts_per_set, pass_threshold: n.pass_threshold }
        : null;
    case "streak":
      return n.streak_length ? { ...base, kind: "streak", streak_length: n.streak_length } : null;
    case "points":
      return n.attempts_per_set && n.max_points_per_attempt && n.pass_threshold
        ? {
            ...base,
            kind: "points",
            attempts_per_set: n.attempts_per_set,
            max_points_per_attempt: n.max_points_per_attempt,
            pass_threshold: n.pass_threshold,
          }
        : null;
    case "timed":
      return n.attempts_per_set && n.time_limit_seconds && n.pass_threshold
        ? {
            ...base,
            kind: "timed",
            attempts_per_set: n.attempts_per_set,
            time_limit_seconds: n.time_limit_seconds,
            pass_threshold: n.pass_threshold,
          }
        : null;
  }
}

/** Everything wrong with the form that the API would reject, in reading order. */
export function validateForm(form: DrillForm): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (form.title.trim() === "") {
    problems.push({ key: "title", message: "Enter a title." });
  } else if (form.title.trim().length > MAX_TITLE) {
    problems.push({ key: "title", message: `The title can be up to ${MAX_TITLE} characters.` });
  }
  if (form.description.length > MAX_DESCRIPTION) {
    problems.push({
      key: "description",
      message: `The description can be up to ${MAX_DESCRIPTION.toLocaleString("en-US")} characters.`,
    });
  }
  if (form.instructions.trim() === "") {
    problems.push({ key: "instructions", message: "Enter instructions." });
  } else if (form.instructions.trim().length > MAX_INSTRUCTIONS) {
    problems.push({
      key: "instructions",
      message: `The instructions can be up to ${MAX_INSTRUCTIONS.toLocaleString("en-US")} characters.`,
    });
  }
  const numbers = numbersFor(form);
  for (const field of SCORING_FIELDS[form.scoring_kind]) {
    if (numbers[field] === null) {
      problems.push({ key: `scoring.${field}`, message: "Enter a whole number of 1 or more." });
    }
  }
  const limit = maxPassThreshold(form);
  const threshold = numbers.pass_threshold;
  if (limit !== null && typeof threshold === "number" && threshold > limit) {
    problems.push({
      key: "scoring.pass_threshold",
      message:
        form.scoring_kind === "points"
          ? `At most ${limit}, the attempts per set times the most points per attempt.`
          : `At most ${limit}, the attempts per set.`,
    });
  }
  return problems;
}

/** The API body for a valid form. Call validateForm first. */
export function toContent(form: DrillForm): DrillContent {
  const scoring = scoringFromForm(form);
  if (scoring === null) {
    throw new Error("The scoring is not valid; check validateForm before calling toContent.");
  }
  const description = form.description.trim();
  return {
    title: form.title.trim(),
    description: description === "" ? null : description,
    difficulty: form.difficulty,
    tag_ids: form.tag_ids,
    instructions: form.instructions.trim(),
    layout: form.layout,
    scoring,
  };
}

/** JSON with sorted keys, so equal data compares equal whatever its key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/**
 * Saving creates a new drill version only when the layout, the instructions or the
 * scoring changed. The title, description, difficulty and tags belong to the drill.
 */
export function willCreateVersion(form: DrillForm, version: DrillVersionRead): boolean {
  if (canonical(form.layout) !== canonical(version.layout)) return true;
  if (form.instructions.trim() !== version.instructions.trim()) return true;
  const scoring = scoringFromForm(form);
  return scoring === null || canonical(scoring) !== canonical(version.scoring);
}

/** Whether the form differs from the one it started as. */
export function isDirty(form: DrillForm, saved: DrillForm): boolean {
  return canonical(form) !== canonical(saved);
}

/** The rule in plain words, for under the scoring fields. */
export function readsAs(form: DrillForm): string {
  const n = form.attempts_per_set.trim();
  const t = form.pass_threshold.trim();
  switch (form.scoring_kind) {
    case "success_count":
      return `Reads as: make ${t} of ${n} per set.`;
    case "streak":
      return `Reads as: make ${form.streak_length.trim()} in a row.`;
    case "points":
      return `Reads as: score ${t} points per set of ${n} attempts, up to ${form.max_points_per_attempt.trim()} each.`;
    case "timed":
      return `Reads as: make ${t} of ${n} within ${form.time_limit_seconds.trim()} seconds.`;
  }
}
