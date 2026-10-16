"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createDrillAction, updateDrillAction } from "@/app/(app)/drills/actions";
import type { DrillLayout, DrillRead, TagRead } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import {
  emptyForm,
  formFromDrill,
  isDirty,
  toContent,
  validateForm,
  willCreateVersion,
  type DrillForm,
} from "@/lib/drill-form";
import { problemsFromDetails, type Problem } from "@/lib/drill-problems";

import { TableEditor } from "../table-editor/table-editor";
import { Button } from "../ui/button";
import { DetailFields, InstructionsField } from "./detail-fields";
import { ProblemList } from "./problem-list";
import { ScoringFields } from "./scoring-fields";
import { TagPicker } from "./tag-picker";

type Tab = "details" | "scoring" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "scoring", label: "Scoring" },
  { id: "notes", label: "Notes" },
];

function tabForKey(key: string): Tab {
  if (key.startsWith("scoring")) return "scoring";
  if (key === "instructions") return "notes";
  return "details";
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-3", className)}>
      <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

type DrillEditorProps = {
  /** The drill to edit; leave out to create a new one. */
  drill?: DrillRead;
  tags: TagRead[];
};

/** Create or edit a drill: layout, details, scoring and tags, with an explicit Save. */
export function DrillEditor({ drill, tags: initialTags }: DrillEditorProps) {
  const router = useRouter();
  const version = drill?.current_version ?? null;
  const initial = useMemo(() => (drill ? formFromDrill(drill) : emptyForm()), [drill]);
  const [form, setForm] = useState<DrillForm>(initial);
  const [tags, setTags] = useState<TagRead[]>(initialTags);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [selectedBall, setSelectedBall] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [isSaving, startSaving] = useTransition();
  const isLeaving = useRef(false);

  const dirty = isDirty(form, initial);
  const clientProblems: Problem[] = hasTriedSave
    ? validateForm(form).map((found) => ({ ...found, code: "", path: "" }))
    : [];
  const problems = [...clientProblems, ...serverProblems];
  const errorFor = (key: string) => problems.find((problem) => problem.key === key)?.message;

  // Warn before the browser closes the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (isLeaving.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<DrillForm>) {
    setForm((current) => ({ ...current, ...patch }));
    // What the server said is about the old form; the person is changing it.
    setServerProblems([]);
    setSaveError(null);
  }

  function goToField(key: string) {
    setTab(tabForKey(key));
    // Wait a frame so a tab that was hidden is shown before it takes focus.
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
      field?.scrollIntoView({ block: "center" });
      field?.focus();
    });
  }

  function selectBall(ballId: string) {
    setSelectedBall(ballId);
    document.querySelector('[data-testid="table-editor"]')?.scrollIntoView({ block: "center" });
  }

  function save() {
    const found = validateForm(form);
    setHasTriedSave(true);
    if (found.length > 0) {
      goToField(found[0].key);
      return;
    }
    if (drill && !version) {
      setSaveError("This drill has no version to edit.");
      return;
    }
    const content = toContent(form);
    setServerProblems([]);
    setSaveError(null);
    setIsStale(false);
    startSaving(async () => {
      const result =
        drill && version
          ? await updateDrillAction(drill.id, { ...content, base_drill_version_id: version.id })
          : await createDrillAction(content);
      if (result.ok) {
        isLeaving.current = true;
        router.push(`/drills/${result.data.id}`);
      } else if (result.code === "stale_version") {
        setIsStale(true);
      } else if (result.details) {
        setServerProblems(problemsFromDetails(result.details, form.layout));
      } else {
        setSaveError(result.error);
      }
    });
  }

  function discard() {
    setForm(initial);
    setServerProblems([]);
    setHasTriedSave(false);
    setSaveError(null);
    setIsStale(false);
    setSelectedBall(null);
  }

  const currentNumber = version?.version_number;
  const changesVersion = version ? willCreateVersion(form, version) : true;
  const saveLabel = !drill ? "Create drill" : changesVersion ? `Save v${(currentNumber ?? 0) + 1}` : "Save";
  const nextNumber = (currentNumber ?? 0) + 1;
  // A long form for a desktop header and a short one for a phone, as in the design.
  const subtitle = !drill
    ? { long: "New drill · saving creates v1", short: "New drill · saving creates v1" }
    : changesVersion
      ? {
          long: `Editing v${currentNumber} · the layout, instructions or scoring changed, so saving creates v${nextNumber} · runs on earlier versions keep their version`,
          short: `Editing v${currentNumber} · saving makes v${nextNumber}`,
        }
      : {
          long: `Editing v${currentNumber} · saving keeps v${currentNumber}; only a changed layout, instructions or scoring creates a new version`,
          short: `Editing v${currentNumber} · no new version`,
        };

  return (
    <div className="flex flex-col" data-testid="drill-editor">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-surface px-4 py-3 md:px-8">
        <Link
          href={drill ? `/drills/${drill.id}` : "/drills"}
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-text"
          data-testid="drill-editor-back"
        >
          ← {drill ? "Drill" : "Drills"}
        </Link>
        <div className="min-w-0 flex-[1_1_240px]">
          <h1 className="truncate font-display text-[26px] font-bold leading-none" data-testid="drill-editor-heading">
            {form.title.trim() || (drill ? drill.title : "New drill")}
          </h1>
          <p className="mt-1 text-[13px] text-muted" data-testid="drill-editor-subtitle">
            <span className="md:hidden">{subtitle.short}</span>
            <span className="hidden md:inline">{subtitle.long}</span>
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button disabled={!dirty || isSaving} data-testid="drill-editor-discard" onClick={discard}>
            Discard changes
          </Button>
          <Button
            variant="primary"
            disabled={isSaving || (drill !== undefined && !dirty)}
            data-testid="drill-editor-save"
            onClick={save}
          >
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-start gap-6 px-4 pb-10 pt-6 md:px-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {isStale && (
            <div
              role="alert"
              data-testid="drill-editor-stale"
              className="flex flex-col gap-2 rounded-xl border border-miss bg-miss-soft p-3.5"
            >
              <p className="font-semibold text-miss">This drill was saved somewhere else</p>
              <p className="text-sm">
                Saving now would overwrite the newer version. Your edits are still on this page. Open
                the latest version to see what changed, then make your edits again.
              </p>
              {drill && (
                <a
                  href={`/drills/${drill.id}/edit`}
                  className="inline-flex min-h-11 w-fit items-center rounded-[10px] border border-miss px-3 text-sm font-semibold text-miss"
                  data-testid="drill-editor-stale-reload"
                >
                  Open the latest version
                </a>
              )}
            </div>
          )}
          {saveError && (
            <p role="alert" className="rounded-xl border border-miss bg-miss-soft p-3.5 text-sm" data-testid="drill-editor-error">
              {saveError}
            </p>
          )}
          <ProblemList problems={problems} onSelectBall={selectBall} onGoToField={goToField} />
          <TableEditor
            layout={form.layout}
            onChange={(layout: DrillLayout) => update({ layout })}
            selected={selectedBall}
            onSelectedChange={setSelectedBall}
          />
        </div>

        <aside
          aria-label="Drill settings"
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 rounded-[14px] border border-line bg-surface p-4 md:p-5"
        >
          <div role="tablist" aria-label="Drill settings" className="grid grid-cols-3 border-b border-line md:hidden">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                data-testid={`drill-editor-tab-${item.id}`}
                className={cx(
                  "min-h-11 border-b-2 text-[15px]",
                  tab === item.id
                    ? "border-chalk font-semibold text-text"
                    : "border-transparent font-medium text-muted",
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={cx("flex flex-col gap-5", tab !== "details" && "hidden md:flex")}>
            <Section title="Details">
              <DetailFields form={form} onChange={update} errorFor={errorFor} />
              <TagPicker
                tags={tags}
                selectedIds={form.tag_ids}
                error={errorFor("tags")}
                onChange={(tag_ids) => update({ tag_ids })}
                onTagCreated={(tag) => {
                  setTags((current) => [...current, tag]);
                  // Add to the newest tag ids, not the ones from when Add tag was pressed.
                  setForm((current) => ({ ...current, tag_ids: [...current.tag_ids, tag.id] }));
                  setServerProblems([]);
                  setSaveError(null);
                }}
              />
            </Section>
          </div>

          <div className={cx("flex flex-col gap-5", tab !== "notes" && "hidden md:flex")}>
            <Section title="Instructions" className="md:border-t md:border-line md:pt-5">
              <InstructionsField form={form} onChange={update} errorFor={errorFor} />
            </Section>
          </div>

          <div className={cx("flex flex-col gap-5", tab !== "scoring" && "hidden md:flex")}>
            <Section title="Scoring" className="md:border-t md:border-line md:pt-5">
              <ScoringFields
                form={form}
                onChange={update}
                errorFor={errorFor}
                currentVersionNumber={currentNumber}
              />
            </Section>
          </div>
        </aside>
      </div>
    </div>
  );
}
