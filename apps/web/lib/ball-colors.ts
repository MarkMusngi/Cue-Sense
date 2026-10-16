// Ball colours, as on a real set. Layout v2 balls carry no number (ADR 0008); the colour
// comes from the number in the ball's id (ball_3), so the same ball keeps its colour.

const BALL_COLORS: Record<number, string> = {
  1: "#F2C230",
  2: "#2F5FD0",
  3: "#D2412F",
  4: "#6A3FB5",
  5: "#E8782A",
  6: "#1F7A4D",
  7: "#8B2D2D",
  8: "#0B0C0D",
};

export const CUE_BALL_COLOR = "#F7F4EC";
const FALLBACK_COLOR = "#E8E1CF";

/** Ball ids look like ball_3; the number picks the colour. */
export function ballNumber(id: string): number | null {
  const match = /^ball_(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

/** Cue ball ivory, then the eight colours repeating for balls 9 and up. */
export function ballColor(id: string): string {
  const number = ballNumber(id);
  if (number === null) return FALLBACK_COLOR;
  if (number === 0) return CUE_BALL_COLOR;
  return BALL_COLORS[((number - 1) % 8) + 1] ?? FALLBACK_COLOR;
}
