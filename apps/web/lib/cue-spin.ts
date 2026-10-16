// Cue ball hit point, as in layout schema v2's cue_spin (ADR 0008): x is side spin
// (-1 left, 1 right), y is vertical (-1 bottom, 1 top), with x² + y² <= 1.

export type Spin = { x: number; y: number };

// Closer to the middle than this reads as no spin on that axis.
const CENTER = 0.15;
// Below this it is "slight".
const STRONG = 0.5;

export function clampSpin(spin: Spin): Spin {
  const length = Math.hypot(spin.x, spin.y);
  return length <= 1 ? spin : { x: spin.x / length, y: spin.y / length };
}

/** Plain words for a hit point, e.g. "Below center (draw), slight right side". */
export function describeSpin(spin: Spin): string {
  const { x, y } = clampSpin(spin);
  const parts: string[] = [];
  if (Math.abs(y) >= CENTER) {
    const where = y < 0 ? "below center (draw)" : "above center (follow)";
    parts.push(Math.abs(y) < STRONG ? `slightly ${where}` : where);
  }
  if (Math.abs(x) >= CENTER) {
    const side = x < 0 ? "left side" : "right side";
    parts.push(Math.abs(x) < STRONG ? `slight ${side}` : side);
  }
  const text = parts.length > 0 ? parts.join(", ") : "center ball";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
