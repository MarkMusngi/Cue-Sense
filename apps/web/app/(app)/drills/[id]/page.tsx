import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DifficultyPips } from "@/components/difficulty-pips";
import { DrillActions } from "@/components/drill-detail/drill-actions";
import { ScoringSummary } from "@/components/drill-detail/scoring-summary";
import { VersionList } from "@/components/drill-detail/version-list";
import { TableEditor } from "@/components/table-editor/table-editor";
import { ErrorCard } from "@/components/state-cards";
import { getDrill, getDrillVersions } from "@/lib/api-client";

export const metadata: Metadata = { title: "Drill · Cue Sense" };

// Render on every request so a saved edit shows straight away.
export const dynamic = "force-dynamic";

const STATUS_LABELS = { draft: "Draft", active: "Active", archived: "Archived" } as const;

function Heading({ children }: { children: string }) {
  return (
    <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </h2>
  );
}

export default async function DrillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [drill, versions] = await Promise.all([getDrill(id), getDrillVersions(id)]);

  if (!drill.ok) {
    // A malformed id is a 422 from the API; to the person it is the same as a missing drill.
    if (drill.code === "not_found" || drill.code === "validation_failed") notFound();
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <ErrorCard message={drill.error} code={drill.code} />
      </div>
    );
  }

  const data = drill.data;
  const version = data.current_version;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8" data-testid="drill-detail">
      <Link href="/drills" className="inline-flex min-h-11 w-fit items-center text-sm text-muted hover:text-text">
        ← Drills
      </Link>

      <header className="flex flex-col gap-3">
        <h1
          className="font-display text-4xl font-bold leading-none md:text-5xl"
          data-testid="drill-detail-title"
        >
          {data.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <DifficultyPips difficulty={data.difficulty} />
          <span data-testid="drill-detail-status">{STATUS_LABELS[data.status]}</span>
          {version && <span className="font-mono">v{version.version_number}</span>}
        </div>
        {data.description && <p className="max-w-prose text-[15px] text-muted">{data.description}</p>}
        <DrillActions drill={data} />
      </header>

      {version && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="overflow-hidden rounded-[14px] border border-line">
            <TableEditor layout={version.layout} readOnly />
          </div>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-1.5">
              <Heading>Instructions</Heading>
              <p
                className="whitespace-pre-line text-base leading-relaxed"
                data-testid="drill-detail-instructions"
              >
                {version.instructions}
              </p>
            </section>

            <section className="flex flex-col gap-1.5">
              <Heading>Scoring</Heading>
              <ScoringSummary scoring={version.scoring} />
              {data.tags.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-2" data-testid="drill-detail-tags">
                  {data.tags.map((tag) => (
                    <li
                      key={tag.id}
                      className="inline-flex h-[30px] items-center rounded-full border border-line px-3 text-[13px] text-muted"
                    >
                      {tag.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <section className="flex max-w-xl flex-col gap-2">
        <Heading>Versions</Heading>
        {versions.ok ? (
          <VersionList versions={versions.data.items} currentVersionId={version?.id ?? null} />
        ) : (
          <p role="alert" className="text-sm text-miss">
            Could not load the version history: {versions.error}
          </p>
        )}
      </section>
    </div>
  );
}
