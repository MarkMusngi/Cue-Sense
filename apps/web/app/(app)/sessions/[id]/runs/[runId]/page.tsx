import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Runner } from "@/components/runner/runner";
import { ErrorCard } from "@/components/state-cards";
import {
  getAttempts,
  getDrill,
  getDrillRun,
  getDrillVersions,
  getSession,
} from "@/lib/api-client";

export const metadata: Metadata = { title: "Drill run · Cue Sense" };

// Render on every request: the runner starts from the server's attempts.
export const dynamic = "force-dynamic";

function Failure({ message, code }: { message: string; code?: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-4 md:p-8">
      <ErrorCard message={message} code={code} />
    </div>
  );
}

export default async function RunnerPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const [run, attempts, session] = await Promise.all([
    getDrillRun(runId),
    getAttempts(runId),
    getSession(id),
  ]);

  for (const result of [run, session]) {
    if (!result.ok && (result.code === "not_found" || result.code === "validation_failed")) {
      notFound();
    }
  }
  if (!run.ok) return <Failure message={run.error} code={run.code} />;
  if (!session.ok) return <Failure message={session.error} code={session.code} />;
  // A run belongs to one session; any other address is a wrong link.
  if (run.data.practice_session_id !== id) notFound();
  if (!attempts.ok) return <Failure message={attempts.error} code={attempts.code} />;

  const [drill, versions] = await Promise.all([
    getDrill(run.data.drill_id),
    getDrillVersions(run.data.drill_id),
  ]);
  if (!drill.ok) return <Failure message={drill.error} code={drill.code} />;
  if (!versions.ok) return <Failure message={versions.error} code={versions.code} />;

  // The run shows the version it started with, whatever the drill has become since.
  const version = versions.data.items.find((item) => item.id === run.data.drill_version_id);
  if (!version) {
    return <Failure message="The version this drill run started with could not be found." />;
  }

  return (
    <Runner
      sessionId={id}
      sessionStartedAt={session.data.started_at}
      sessionEndedAt={session.data.ended_at}
      run={run.data}
      drillTitle={drill.data.title}
      version={version}
      initialAttempts={attempts.data}
    />
  );
}
