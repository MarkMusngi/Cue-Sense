import Link from "next/link";

import { cx } from "@/lib/cx";
import { RANGE_DAYS, type RangeDays } from "@/lib/stats";

/** Choose how many days to look back. Links, so the choice is in the URL and survives a reload. */
export function RangeToggle({ range, drill }: { range: RangeDays; drill?: string }) {
  return (
    <nav
      aria-label="Time range"
      className="flex rounded-[10px] border border-line bg-surface p-[3px]"
    >
      {RANGE_DAYS.map((days) => {
        const query = new URLSearchParams({ range: String(days) });
        if (drill) query.set("drill", drill);
        const active = days === range;
        return (
          <Link
            key={days}
            href={`/progress?${query.toString()}`}
            aria-current={active ? "true" : undefined}
            data-testid={`progress-range-${days}`}
            className={cx(
              "flex min-h-11 min-w-14 items-center justify-center rounded-lg px-3 text-sm",
              active ? "bg-raised font-semibold text-text" : "text-muted hover:text-text",
            )}
          >
            {days} days
          </Link>
        );
      })}
    </nav>
  );
}
