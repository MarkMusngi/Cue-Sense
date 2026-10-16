// Turns the API's error details into problems the drill editor can show next to the
// field they belong to (docs/architecture.md section 4.6, error shape). A detail's path
// points into the request body, for example ["layout", "object_balls", 2].

import type { ApiErrorDetail, DrillLayout } from "@/lib/api-client";
import { SCORING_FIELD_LABELS } from "@/lib/drill-form";
import { ballLabel } from "@/lib/layout-ids";

export type Problem = {
  /** Which part of the form: title, description, difficulty, instructions, tags,
   *  scoring.<field>, ball:<id>, layout or form. */
  key: string;
  /** What the person should do, in plain words. */
  message: string;
  /** The API's code and path, for the small mono line under the message. */
  code: string;
  path: string;
  /** Set for a problem with one ball, so the editor can select it. */
  ball_id?: string;
};

type PathPart = ApiErrorDetail["path"][number];

/** layout.object_balls[1], the way the design shows a path. */
export function formatPath(path: ApiErrorDetail["path"]): string {
  return path.reduce<string>(
    (text, part) => (typeof part === "number" ? `${text}[${part}]` : text ? `${text}.${part}` : part),
    "",
  );
}

function ballIdAt(path: PathPart[], layout: DrillLayout): string | undefined {
  if (path[1] === "cue_ball") return layout.cue_ball.id;
  if (path[1] === "object_balls" && typeof path[2] === "number") {
    return layout.object_balls[path[2]]?.id;
  }
  return undefined;
}

/** Which part of the form a detail belongs to. */
export function fieldKeyForPath(path: ApiErrorDetail["path"], layout: DrillLayout): string {
  const [first, second] = path;
  switch (first) {
    case "title":
    case "description":
    case "difficulty":
    case "instructions":
      return first;
    case "tag_ids":
      return "tags";
    case "layout": {
      const ballId = ballIdAt([...path], layout);
      return ballId ? `ball:${ballId}` : "layout";
    }
    case "scoring":
      return typeof second === "string" ? `scoring.${second}` : "scoring";
    default:
      return "form";
  }
}

const TEXT_MESSAGES: Record<string, string> = {
  title: "Enter a title of up to 200 characters.",
  description: "The description can be up to 2,000 characters.",
  difficulty: "Pick a difficulty from 1 to 5.",
  instructions: "Enter instructions of up to 10,000 characters.",
};

function friendlyMessage(detail: ApiErrorDetail, key: string, layout: DrillLayout): string {
  const ballId = ballIdAt([...detail.path], layout);
  const ball = ballId ? ballLabel(ballId) : "A ball";
  switch (detail.code) {
    case "balls_overlap":
      return `${ball} overlaps another ball.`;
    case "ball_out_of_bounds":
      return `${ball} is not fully on the table.`;
    case "too_many_object_balls":
      return "A drill can have at most 15 object balls.";
    case "position_out_of_bounds":
      return "The landing zone is not on the table.";
    case "invalid_id":
    case "duplicate_id":
      return `${ball} has an id that is not allowed.`;
    case "unknown_tag":
      return "One of the tags no longer exists. Reload the page to see the current tags.";
    case "unsupported_schema_version":
      return "This layout is from an older version of the app. Reload the page.";
    case "pass_threshold_too_high": {
      // The API says "pass_threshold can be at most 10."; use the field's own name.
      const limit = /at most (\d+)/.exec(detail.message)?.[1];
      return limit ? `Makes to pass can be at most ${limit}.` : "Makes to pass is too high.";
    }
    default:
      break;
  }
  if (TEXT_MESSAGES[key]) return TEXT_MESSAGES[key];
  if (key.startsWith("scoring.")) {
    const field = key.slice("scoring.".length);
    return SCORING_FIELD_LABELS[field]
      ? `${SCORING_FIELD_LABELS[field]}: enter a whole number of 1 or more.`
      : detail.message;
  }
  return detail.message;
}

/** The API's details as problems, in the order the API gave them. */
export function problemsFromDetails(details: ApiErrorDetail[], layout: DrillLayout): Problem[] {
  return details.map((detail) => {
    const key = fieldKeyForPath(detail.path, layout);
    return {
      key,
      message: friendlyMessage(detail, key, layout),
      code: detail.code,
      path: formatPath(detail.path),
      ball_id: key.startsWith("ball:") ? key.slice("ball:".length) : undefined,
    };
  });
}
