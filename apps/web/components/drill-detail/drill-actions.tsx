"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { changeStatusAction, duplicateDrillAction } from "@/app/(app)/drills/actions";
import type { ApiResult, DrillRead } from "@/lib/api-client";

import { Button } from "../ui/button";
import { LinkButton } from "../ui/link-button";

/** Edit, duplicate, and the status changes the API allows for this drill's status. */
export function DrillActions({ drill }: { drill: DrillRead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ApiResult<DrillRead>>, then: (result: DrillRead) => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) then(result.data);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2" data-testid="drill-actions">
      <div className="flex flex-wrap gap-2">
        <LinkButton
          href={`/drills/${drill.id}/edit`}
          variant="primary"
          data-testid="drill-detail-edit"
        >
          Edit
        </LinkButton>
        <Button
          disabled={isPending}
          data-testid="drill-detail-duplicate"
          onClick={() =>
            run(
              () => duplicateDrillAction(drill.id),
              (copy) => router.push(`/drills/${copy.id}`),
            )
          }
        >
          Duplicate
        </Button>
        {drill.status === "draft" && (
          <Button
            disabled={isPending}
            data-testid="drill-detail-activate"
            onClick={() =>
              run(
                () => changeStatusAction(drill.id, "active"),
                () => router.refresh(),
              )
            }
          >
            Activate
          </Button>
        )}
        {drill.status === "archived" && (
          <Button
            disabled={isPending}
            data-testid="drill-detail-unarchive"
            onClick={() =>
              run(
                () => changeStatusAction(drill.id, "active"),
                () => router.refresh(),
              )
            }
          >
            Unarchive
          </Button>
        )}
        {drill.status !== "archived" && (
          <Button
            variant="ghost"
            disabled={isPending}
            data-testid="drill-detail-archive"
            onClick={() =>
              run(
                () => changeStatusAction(drill.id, "archived"),
                () => router.refresh(),
              )
            }
          >
            Archive
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-miss" data-testid="drill-actions-error">
          {error}
        </p>
      )}
    </div>
  );
}
