"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startRunInSessionAction } from "@/app/(app)/sessions/actions";
import type { DrillRead } from "@/lib/api-client";
import { scoringLabel } from "@/lib/scoring-text";
import { useHydrated } from "@/lib/use-hydrated";

import { DifficultyPips } from "../difficulty-pips";
import { Button } from "../ui/button";

/** Choose a drill to start a drill run on in the open session. Archived drills are left out. */
export function DrillPicker({ sessionId, drills }: { sessionId: string; drills: DrillRead[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isHydrated = useHydrated();

  const startable = drills.filter((drill) => drill.status !== "archived");
  const shown = startable.filter((drill) =>
    drill.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function start(drillId: string) {
    setError(null);
    setStartingId(drillId);
    startTransition(async () => {
      const result = await startRunInSessionAction(sessionId, drillId);
      if (result.ok) router.push(`/sessions/${sessionId}/runs/${result.data.run_id}`);
      else {
        setError(result.error);
        setStartingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="drill-picker" data-hydrated={isHydrated}>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Find a drill
        <input
          type="search"
          value={search}
          placeholder="Search by title"
          data-testid="drill-picker-search"
          className="min-h-11 rounded-[10px] border border-control bg-surface px-3 text-[15px] font-normal text-text"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {startable.length === 0 ? (
        <p className="text-sm text-muted" data-testid="drill-picker-empty">
          No drills to start yet. Create one on the Drills screen.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted" data-testid="drill-picker-none">
          No drill matches “{search.trim()}”.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line">
          {shown.map((drill, index) => (
            <li
              key={drill.id}
              className={`flex items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-line" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold leading-tight">{drill.title}</p>
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <DifficultyPips difficulty={drill.difficulty} />
                  {drill.current_version && <span>{scoringLabel(drill.current_version.scoring)}</span>}
                </div>
              </div>
              <Button
                variant="primary"
                disabled={isPending}
                data-testid={`drill-picker-start-${drill.id}`}
                onClick={() => start(drill.id)}
              >
                {startingId === drill.id ? "Starting…" : "Start"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-miss" data-testid="drill-picker-error">
          {error}
        </p>
      )}
    </div>
  );
}
