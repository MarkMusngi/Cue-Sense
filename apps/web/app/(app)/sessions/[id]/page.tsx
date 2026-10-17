import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DrillPicker } from "@/components/sessions/drill-picker";
import { LocalTime } from "@/components/sessions/local-time";
import { FinishSessionButton } from "@/components/sessions/session-buttons";
import { ErrorCard } from "@/components/state-cards";
import { buttonClasses } from "@/components/ui/button-styles";
import { getAttempts, getDrills, getSession } from "@/lib/api-client";
import { scoringLabel } from "@/lib/scoring-text";
import { sessionDuration, totalsOf } from "@/lib/session-summary";

export const metadata: Metadata = { title: "Session · Cue Sense" };

// Render on every request so the runs and totals are current.
export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, drills] = await Promise.all([getSession(id), getDrills()]);

  if (!session.ok) {
    if (session.code === "not_found" || session.code === "validation_failed") notFound();
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8">
        <ErrorCard message={session.error} code={session.code} />
      </div>
    );
  }

  const data = session.data;
  const isOpen = data.ended_at === null;
  const drillList = drills.ok ? drills.data.items : [];
  const titles = new Map(drillList.map((drill) => [drill.id, drill]));
  // Each run's attempts give its totals; a session has few runs, so fetch them together.
  const attempts = await Promise.all(data.drill_runs.map((run) => getAttempts(run.id)));
  const duration = sessionDuration(data.started_at, data.ended_at);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8" data-testid="session-hub">
      <Link
        href="/sessions"
        className="inline-flex min-h-11 w-fit items-center text-sm text-muted hover:text-text"
      >
        ← Sessions
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold leading-none md:text-4xl">
            <LocalTime iso={data.started_at} />
          </h1>
          <p className="text-sm text-muted" data-testid="session-status">
            {isOpen ? "In progress" : `Finished · ${duration}`}
            {data.location ? ` · ${data.location}` : ""}
          </p>
        </div>
        {isOpen && <FinishSessionButton sessionId={data.id} />}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-muted">
          Drill runs
        </h2>
        {data.drill_runs.length === 0 ? (
          <p
            className="rounded-[14px] border border-dashed border-control p-5 text-[15px] text-muted"
            data-testid="session-runs-empty"
          >
            No drill runs yet.{isOpen ? " Pick a drill below to start one." : ""}
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-line" data-testid="session-runs">
            {data.drill_runs.map((run, index) => {
              const drill = titles.get(run.drill_id);
              const runAttempts = attempts[index];
              const totals = runAttempts.ok ? totalsOf(runAttempts.data) : null;
              const isRunOpen = run.ended_at === null;
              return (
                <li
                  key={run.id}
                  className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? "border-t border-line" : ""}`}
                  data-testid={`session-run-${run.run_number}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl font-semibold leading-tight">
                      {drill?.title ?? "Drill"}
                    </p>
                    <p className="text-[13px] text-muted">
                      Run {run.run_number}
                      {drill?.current_version ? ` · ${scoringLabel(drill.current_version.scoring)}` : ""}
                      {totals ? (
                        <>
                          {" · "}
                          <span data-testid={`session-run-total-${run.run_number}`}>
                            {totals.made} of {totals.taken}
                          </span>
                        </>
                      ) : (
                        " · totals unavailable"
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/sessions/${data.id}/runs/${run.id}`}
                    className={buttonClasses(isOpen && isRunOpen ? "primary" : "secondary")}
                    data-testid={`session-run-open-${run.run_number}`}
                  >
                    {isOpen && isRunOpen ? "Resume" : "View"}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {isOpen && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-muted">
            Start a drill run
          </h2>
          {drills.ok ? (
            <DrillPicker sessionId={data.id} drills={drillList} />
          ) : (
            <ErrorCard message={drills.error} code={drills.code} />
          )}
        </section>
      )}
    </div>
  );
}
