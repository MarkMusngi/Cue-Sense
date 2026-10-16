import { cx } from "@/lib/cx";
import { describeRailSights, type RailMark } from "@/lib/rail-sights";

type RailSightsProps = {
  marks: readonly RailMark[];
  /** Width and height of each sight in px. */
  size?: number;
  className?: string;
};

const DIAMOND = "M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z";
const LEFT_HALF = "M10 1.5 L1.5 10 L10 18.5 Z";

/**
 * Set progress drawn like the table's diamond sights: filled for a make, an amber
 * cross for a miss, half for a partial, dashed while an attempt is being saved, and
 * an outline for each attempt still to go.
 */
export function RailSights({ marks, size = 20, className }: RailSightsProps) {
  return (
    <div
      role="img"
      aria-label={`Set progress: ${describeRailSights(marks)}`}
      data-testid="rail-sights"
      className={cx("flex flex-wrap items-center gap-1.5", className)}
    >
      {marks.map((mark, index) => (
        <svg
          key={index}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          aria-hidden="true"
          data-testid={`rail-sight-${index}`}
          data-mark={mark}
        >
          <Sight mark={mark} />
        </svg>
      ))}
    </div>
  );
}

function Sight({ mark }: { mark: RailMark }) {
  switch (mark) {
    case "success":
      return <path d={DIAMOND} fill="var(--chalk)" />;
    case "fail":
      return (
        <>
          <path d={DIAMOND} fill="none" stroke="var(--miss)" strokeWidth="1.6" />
          <path d="M7 7 L13 13 M13 7 L7 13" stroke="var(--miss)" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case "partial":
      return (
        <>
          <path d={LEFT_HALF} fill="var(--part)" />
          <path d={DIAMOND} fill="none" stroke="var(--part)" strokeWidth="1.6" />
        </>
      );
    case "pending":
      return (
        <path
          d={DIAMOND}
          fill="var(--chalk-soft)"
          stroke="var(--chalk)"
          strokeWidth="1.6"
          strokeDasharray="3 2"
        />
      );
    case "empty":
      return <path d={DIAMOND} fill="none" stroke="var(--control)" strokeWidth="1.4" />;
  }
}
