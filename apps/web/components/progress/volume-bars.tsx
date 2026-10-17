import type { WeeklyVolumeItem } from "@/lib/api-client";
import { barShares, shortDate } from "@/lib/stats";

const BAR_AREA_PX = 72;

/** Attempts per week as bars. Weeks with no attempts show a thin stub so the gap is visible. */
export function VolumeBars({ items }: { items: WeeklyVolumeItem[] }) {
  const shares = barShares(items.map((item) => item.attempts));
  const label = `Attempts per week: ${items.map((item) => `${shortDate(item.week_start)}, ${item.attempts}`).join("; ")}`;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={label}
        data-testid="volume-bars"
        className="grid items-end gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          height: BAR_AREA_PX,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.week_start}
            data-testid="volume-bar"
            data-attempts={item.attempts}
            title={`Week of ${shortDate(item.week_start)}: ${item.attempts} attempts`}
            className={item.attempts === 0 ? "w-full max-w-12 justify-self-center bg-line" : "w-full max-w-12 justify-self-center bg-chalk"}
            style={{
              height: item.attempts === 0 ? 3 : Math.max(6, Math.round(shares[index] * BAR_AREA_PX)),
              borderRadius: "4px 4px 2px 2px",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{shortDate(items[0].week_start)}</span>
        <span>{shortDate(items[items.length - 1].week_start)}</span>
      </div>
    </div>
  );
}
