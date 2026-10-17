"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  finishSessionAction,
  startDrillRunAction,
  startSessionAction,
} from "@/app/(app)/sessions/actions";
import type { ApiResult, DrillRead } from "@/lib/api-client";
import { useHydrated } from "@/lib/use-hydrated";

import { Button } from "../ui/button";

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-miss" data-testid="session-action-error">
      {message}
    </p>
  );
}

/** Start a new, empty practice session and open it. */
export function StartSessionButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        disabled={isPending}
        data-testid="session-start"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startSessionAction();
            if (result.ok) router.push(`/sessions/${result.data.id}`);
            else setError(result.error);
          });
        }}
      >
        Start a session
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

/** Finish the open session; its drill runs end with it. */
export function FinishSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const isHydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2" data-hydrated={isHydrated}>
      <Button
        disabled={isPending}
        data-testid="session-finish"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await finishSessionAction(sessionId);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        Finish session
      </Button>
      <ErrorLine message={error} />
    </div>
  );
}

/** "Start drill run" on a drill: joins the open session or starts one, then opens the runner. */
export function StartRunButton({ drill }: { drill: DrillRead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isArchived = drill.status === "archived";
  const isHydrated = useHydrated();

  function start() {
    setError(null);
    startTransition(async () => {
      const result: ApiResult<{ session_id: string; run_id: string }> = await startDrillRunAction(drill.id);
      if (result.ok) router.push(`/sessions/${result.data.session_id}/runs/${result.data.run_id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5" data-hydrated={isHydrated}>
      <Button
        variant="primary"
        disabled={isPending || isArchived}
        aria-describedby={isArchived ? "start-run-archived" : undefined}
        data-testid="drill-detail-start-run"
        onClick={start}
      >
        Start drill run
      </Button>
      {isArchived && (
        <p id="start-run-archived" className="text-[13px] text-muted" data-testid="drill-detail-start-run-hint">
          An archived drill can’t be started. Unarchive it first.
        </p>
      )}
      <ErrorLine message={error} />
    </div>
  );
}
