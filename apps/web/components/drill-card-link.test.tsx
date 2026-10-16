// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DrillRead } from "@/lib/api-client";
import { emptyForm } from "@/lib/drill-form";

import { DrillCard } from "./drill-card";

const DRILL: DrillRead = {
  id: "abc-123",
  title: "Stop shot",
  slug: "stop-shot",
  description: null,
  difficulty: 2,
  status: "draft",
  created_at: "2026-10-04T10:00:00Z",
  updated_at: "2026-10-12T10:00:00Z",
  tags: [],
  current_version: {
    id: "v1",
    version_number: 1,
    instructions: "I",
    layout: emptyForm().layout,
    scoring: { schema_version: 1, kind: "streak", streak_length: 5 },
    created_at: "2026-10-04T10:00:00Z",
  },
};

describe("DrillCard link", () => {
  it("links the title to the drill's detail screen and keeps the card id", () => {
    render(
      <ul>
        <DrillCard drill={DRILL} />
      </ul>,
    );

    const link = screen.getByRole("link", { name: "Stop shot" });
    expect(link).toHaveAttribute("href", "/drills/abc-123");
    expect(screen.getByTestId("drill-card")).toHaveAttribute("data-drill-id", "abc-123");
    // One link per card, named by the title, so a screen reader hears a short list of drills.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
