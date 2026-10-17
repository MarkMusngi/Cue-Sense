import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page/page-header";
import { LocalTime } from "@/components/sessions/local-time";
import { StartSessionButton } from "@/components/sessions/session-buttons";
import { ErrorCard } from "@/components/state-cards";
import { buttonClasses } from "@/components/ui/button-styles";
import { getSessions, type PracticeSessionRead } from "@/lib/api-client";
import { sessionDuration } from "@/lib/session-summary";

export const metadata: Metadata = { title: "Sessions · Cue Sense" };

// Render on every request so an open session shows straight away.
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const result = await getSessions(50, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Sessions" />

      {!result.ok ? (
        <ErrorCard message={result.error} code={result.code} />
      ) : (
        <SessionsBody sessions={result.data.items} total={result.data.total} />
      )}
    </div>
  );
}

function SessionsBody({
  sessions,
  total,
}: {
  sessions: PracticeSessionRead[];
  total: number;
}) {
  // Only the newest session can be open.
  const open = sessions[0]?.ended_at === null ? sessions[0] : null;
  const past = open ? sessions.slice(1) : sessions;

  return (
    <>
      <section
        aria-label="Practice"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface p-4"
      >
        {open ? (
          <>
            <div className="flex flex-col gap-0.5" data-testid="session-open">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden="true" className="size-2 rounded-full bg-chalk" />
                Session in progress
              </span>
              <span className="text-[13px] text-muted">
                Started <LocalTime iso={open.started_at} />
              </span>
            </div>
            <Link
              href={`/sessions/${open.id}`}
              className={buttonClasses("primary")}
              data-testid="session-resume"
            >
              Resume
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">No session in progress.</p>
            <StartSessionButton />
          </>
        )}
      </section>

      {past.length === 0 ? (
        <p
          className="rounded-[14px] border border-dashed border-control p-6 text-[15px] text-muted"
          data-testid="session-empty"
        >
          {open ? "Earlier sessions will be listed here." : "No practice sessions yet. Start one above, or start a drill run from a drill."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line" data-testid="session-list">
          {past.map((session, index) => {
            const duration = sessionDuration(session.started_at, session.ended_at);
            return (
              <li key={session.id} className={index > 0 ? "border-t border-line" : ""}>
                <Link
                  href={`/sessions/${session.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-raised"
                  data-testid={`session-row-${session.id}`}
                >
                  <LocalTime iso={session.started_at} className="font-medium" />
                  <span className="flex-1 truncate text-sm text-muted">
                    {session.location ?? ""}
                  </span>
                  <span className="font-mono text-[13px] text-muted">{duration ?? "In progress"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > sessions.length && (
        <p className="text-sm text-muted">Showing the newest {sessions.length} of {total} sessions.</p>
      )}
    </>
  );
}
