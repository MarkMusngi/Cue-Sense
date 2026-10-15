import { clampSpin, describeSpin, type Spin } from "@/lib/cue-spin";

type CueSpinProps = {
  /** The layout's cue_spin; leave out for center ball. */
  spin?: Spin;
  /** Diameter in px. */
  size?: number;
  className?: string;
};

// Cue ball ivory and the hit-point red read on both themes; the outline keeps the
// ball visible on a light surface.
const BALL = "#F2EEE4";
const HIT_POINT = "#D2412F";

/** The cue ball face with the hit point marked, like a pool game's spin picker. */
export function CueSpin({ spin = { x: 0, y: 0 }, size = 64, className }: CueSpinProps) {
  const { x, y } = clampSpin(spin);
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.25 -1.25 2.5 2.5"
      role="img"
      aria-label={`Cue spin: ${describeSpin(spin)}`}
      data-testid="cue-spin"
      className={className}
    >
      <circle r="1" fill={BALL} stroke="var(--control)" strokeWidth="0.06" />
      <path d="M-1 0 H1 M0 -1 V1" stroke="rgba(0, 0, 0, 0.18)" strokeWidth="0.03" />
      <circle r="0.5" fill="none" stroke="rgba(0, 0, 0, 0.12)" strokeWidth="0.03" />
      {/* SVG y grows downwards, while cue_spin y is positive towards the top. */}
      <circle
        cx={x * 0.82}
        cy={-y * 0.82}
        r="0.18"
        fill={HIT_POINT}
        stroke="#FFFFFF"
        strokeWidth="0.05"
        data-testid="cue-spin-dot"
      />
    </svg>
  );
}
