import type { Metadata } from "next";

import { DrillSelect } from "@/components/progress/drill-select";
import { RangeToggle } from "@/components/progress/range-toggle";
import { SuccessChart } from "@/components/progress/success-chart";
import { TagTable } from "@/components/progress/tag-table";
import { VolumeBars } from "@/components/progress/volume-bars";
import { PageHeader } from "@/components/page/page-header";
import {
  getAllDrills,
  getDrillSuccessRate,
  getTagStats,
  getWeeklyVolume,
  type ApiResult,
} from "@/lib/api-client";
import { bucketFor, rangeDates, readProgressParams, shortDate } from "@/lib/stats";

export const metadata: Metadata = { title: "Progress · Cue Sense" };
export const dynamic = "force-dynamic";

function Panel({
  title,
  testId,
  children,
  aside,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold md:text-2xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PanelError({ result, testId }: { result: Extract<ApiResult<unknown>, { ok: false }>; testId: string }) {
  return (
    <p role="alert" data-testid={testId} className="rounded-[10px] border border-miss px-3 py-2 text-sm text-miss">
      {result.error}
    </p>
  );
}

function PanelEmpty({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p data-testid={testId} className="rounded-[10px] border border-dashed border-control p-4 text-[15px] text-muted">
      {children}
    </p>
  );
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = readProgressParams(await searchParams);
  const range = rangeDates(params.range, new Date());

  const [drills, volume, tags] = await Promise.all([
    getAllDrills(),
    getWeeklyVolume(range),
    getTagStats(range),
  ]);

  const options = drills.ok ? drills.data.map((d) => ({ id: d.id, title: d.title })) : [];
  const selected = options.find((d) => d.id === params.drill) ?? options[0];
  const success = selected
    ? await getDrillSuccessRate(selected.id, range, bucketFor(params.range))
    : undefined;
  const hasAttempts = volume.ok && volume.data.items.some((item) => item.attempts > 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 md:p-8">
      <PageHeader title="Progress">
        <RangeToggle range={params.range} drill={selected?.id} />
      </PageHeader>
      <p className="-mt-2 text-sm text-muted" data-testid="progress-range-label">
        {shortDate(range.from)} to {shortDate(range.to)} · voided attempts are not counted
      </p>

      <Panel
        title="Success rate by drill"
        testId="progress-success"
        aside={
          selected && <DrillSelect drills={options} selected={selected.id} range={params.range} />
        }
      >
        {!drills.ok ? (
          <PanelError result={drills} testId="progress-success-error" />
        ) : !selected ? (
          <PanelEmpty testId="progress-success-empty">
            There are no drills yet. Create or seed a drill, then practise it.
          </PanelEmpty>
        ) : !success || !success.ok ? (
          success && <PanelError result={success} testId="progress-success-error" />
        ) : success.data.points.length === 0 ? (
          <PanelEmpty testId="progress-success-empty">
            No attempts for this drill in this range. Pick another drill or a longer range.
          </PanelEmpty>
        ) : (
          <SuccessChart stats={success.data} title={selected.title} />
        )}
      </Panel>

      <Panel title="Attempts per week" testId="progress-volume">
        {!volume.ok ? (
          <PanelError result={volume} testId="progress-volume-error" />
        ) : !hasAttempts ? (
          <PanelEmpty testId="progress-volume-empty">
            No attempts in this range. Charts fill in after you log attempts in a practice session.
          </PanelEmpty>
        ) : (
          <VolumeBars items={volume.data.items} />
        )}
      </Panel>

      <Panel title="By tag" testId="progress-tags">
        {!tags.ok ? (
          <PanelError result={tags} testId="progress-tags-error" />
        ) : tags.data.items.length === 0 ? (
          <PanelEmpty testId="progress-tags-empty">
            No attempts on tagged drills in this range.
          </PanelEmpty>
        ) : (
          <TagTable items={tags.data.items} />
        )}
      </Panel>
    </div>
  );
}
