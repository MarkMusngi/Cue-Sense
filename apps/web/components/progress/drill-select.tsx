"use client";

import { useRouter } from "next/navigation";

type DrillOption = { id: string; title: string };

/** Picks the drill for the success-rate chart by changing the page's URL. */
export function DrillSelect({
  drills,
  selected,
  range,
}: {
  drills: DrillOption[];
  selected: string;
  range: number;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Drill
      <select
        value={selected}
        data-testid="progress-drill-select"
        onChange={(event) =>
          router.replace(`/progress?range=${range}&drill=${encodeURIComponent(event.target.value)}`)
        }
        className="min-h-11 max-w-[60vw] rounded-[10px] border border-control bg-surface px-3 text-[15px] text-text"
      >
        {drills.map((drill) => (
          <option key={drill.id} value={drill.id}>
            {drill.title}
          </option>
        ))}
      </select>
    </label>
  );
}
