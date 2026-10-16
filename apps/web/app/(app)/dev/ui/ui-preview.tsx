"use client";

import { useState, type ReactNode } from "react";

import { PageHeader } from "@/components/page/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CueSpin } from "@/components/ui/cue-spin";
import { OutcomeButton } from "@/components/ui/outcome-button";
import { RailSights } from "@/components/ui/rail-sights";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

const SCORING = [
  { value: "success_count", label: "Makes" },
  { value: "streak", label: "Streak" },
  { value: "points", label: "Points" },
  { value: "timed", label: "Timed" },
] as const;

export function UiPreview() {
  const [scoring, setScoring] = useState<(typeof SCORING)[number]["value"]>("success_count");
  const [tags, setTags] = useState<string[]>(["position"]);
  const toggleTag = (tag: string) =>
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="UI primitives" />

      <Group title="Buttons">
        <Button variant="primary">Start session</Button>
        <Button variant="secondary">Duplicate</Button>
        <Button variant="ghost">Cancel</Button>
        <Button disabled>Disabled</Button>
      </Group>

      <Group title="Outcome buttons">
        <div className="grid w-full grid-cols-3 gap-3">
          <OutcomeButton outcome="success" />
          <OutcomeButton outcome="fail" />
          <OutcomeButton outcome="partial" />
        </div>
        <div className="grid w-full grid-cols-3 gap-3">
          <OutcomeButton outcome="success" size="medium" />
          <OutcomeButton outcome="fail" size="medium" />
          <OutcomeButton outcome="partial" size="medium" />
        </div>
      </Group>

      <Group title="Chips">
        {["position", "safety", "break", "banks"].map((tag) => (
          <Chip key={tag} pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>
            {tag}
          </Chip>
        ))}
      </Group>

      <Group title="Segmented control">
        <SegmentedControl label="Scoring" options={SCORING} value={scoring} onChange={setScoring} />
      </Group>

      <Group title="Rail sights">
        <RailSights marks={["success", "success", "fail", "partial", "pending", "empty", "empty"]} />
        <RailSights marks={["empty", "empty", "empty", "empty", "empty"]} />
      </Group>

      <Group title="Cue spin">
        <CueSpin />
        <CueSpin spin={{ x: 0, y: -0.7 }} />
        <CueSpin spin={{ x: 0.3, y: 0.6 }} />
        <CueSpin spin={{ x: -0.6, y: 0 }} size={96} />
      </Group>

      <Group title="Text fields">
        <TextField label="Drill name" hint="Shown in the library" placeholder="Stop shot ladder" className="w-72" />
        <TextField label="Attempts per set" error="Enter a number from 1 to 100" defaultValue="0" className="w-72" />
      </Group>
    </div>
  );
}
