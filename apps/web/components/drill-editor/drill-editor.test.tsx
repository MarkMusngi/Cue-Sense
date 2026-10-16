// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, DrillRead, TagRead } from "@/lib/api-client";
import { emptyForm } from "@/lib/drill-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const createDrillAction = vi.fn();
const updateDrillAction = vi.fn();
const createTagAction = vi.fn();
vi.mock("@/app/(app)/drills/actions", () => ({
  createDrillAction: (...args: unknown[]) => createDrillAction(...args),
  updateDrillAction: (...args: unknown[]) => updateDrillAction(...args),
  createTagAction: (...args: unknown[]) => createTagAction(...args),
}));

import { DrillEditor } from "./drill-editor";

const TAGS: TagRead[] = [
  { id: "t1", name: "Cut shots", category: "skill", created_at: "2026-10-01T10:00:00Z" },
  { id: "t2", name: "Aim", category: "skill", created_at: "2026-10-01T10:00:00Z" },
];

const LAYOUT = {
  ...emptyForm().layout,
  object_balls: [
    { id: "ball_1", x: 5.5, y: 1.2 },
    { id: "ball_2", x: 6.5, y: 2.5 },
  ],
};

const DRILL: DrillRead = {
  id: "d1",
  title: "30-degree cut",
  slug: "30-degree-cut",
  description: null,
  difficulty: 2,
  status: "active",
  created_at: "2026-10-04T10:00:00Z",
  updated_at: "2026-10-12T10:00:00Z",
  tags: [TAGS[0]],
  current_version: {
    id: "v2",
    version_number: 2,
    instructions: "Cut the 1 ball.",
    layout: LAYOUT,
    scoring: { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 6 },
    created_at: "2026-10-12T10:00:00Z",
  },
};

function ok(data: DrillRead): ApiResult<DrillRead> {
  return { ok: true, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no scrollIntoView; the editor scrolls to a field or ball it takes you to.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("DrillEditor, new drill", () => {
  it("asks for what is missing instead of saving", async () => {
    const user = userEvent.setup();
    render(<DrillEditor tags={TAGS} />);
    expect(screen.getByTestId("drill-editor-subtitle")).toHaveTextContent("saving creates v1");

    await user.click(screen.getByTestId("drill-editor-save"));

    expect(createDrillAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("drill-editor-problems")).toHaveTextContent("2 problems to fix");
    expect(screen.getByTestId("drill-editor-title-error")).toHaveTextContent("Enter a title.");
    expect(screen.getByTestId("drill-editor-instructions-error")).toHaveTextContent(
      "Enter instructions.",
    );
    expect(screen.getByTestId("drill-editor-title")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByTestId("drill-editor-title")).toHaveFocus());
  });

  it("creates the drill with the layout, scoring and chosen tags, then opens it", async () => {
    const user = userEvent.setup();
    createDrillAction.mockResolvedValue(ok({ ...DRILL, id: "new-id" }));
    render(<DrillEditor tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), "Stop shot");
    await user.type(screen.getByTestId("drill-editor-instructions"), "Roll back two feet.");
    await user.click(screen.getByTestId("drill-editor-difficulty-4"));
    await user.click(screen.getByTestId("drill-editor-tag-t2"));
    await user.click(screen.getByTestId("drill-editor-save"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/drills/new-id"));
    const content = createDrillAction.mock.calls[0][0];
    expect(content).toMatchObject({
      title: "Stop shot",
      description: null,
      difficulty: 4,
      tag_ids: ["t2"],
      instructions: "Roll back two feet.",
      scoring: { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 7 },
    });
    expect(content.layout.object_balls).toHaveLength(1);
  });

  it("shows the pass-threshold rule next to the field before saving", async () => {
    const user = userEvent.setup();
    render(<DrillEditor tags={TAGS} />);
    await user.type(screen.getByTestId("drill-editor-title"), "T");
    await user.type(screen.getByTestId("drill-editor-instructions"), "I");
    const threshold = screen.getByTestId("drill-editor-scoring-pass_threshold");
    await user.clear(threshold);
    await user.type(threshold, "11");

    await user.click(screen.getByTestId("drill-editor-save"));

    expect(createDrillAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("drill-editor-scoring-pass_threshold-error")).toHaveTextContent(
      "At most 10, the attempts per set.",
    );
  });

  it("shows only the fields of the chosen rule", async () => {
    const user = userEvent.setup();
    render(<DrillEditor tags={TAGS} />);

    await user.selectOptions(screen.getByTestId("drill-editor-scoring-kind"), "streak");

    expect(screen.getByTestId("drill-editor-scoring-streak_length")).toBeInTheDocument();
    expect(screen.queryByTestId("drill-editor-scoring-attempts_per_set")).toBeNull();
    expect(screen.getByTestId("drill-editor-reads-as")).toHaveTextContent("make 5 in a row");
  });

  it("creates a tag and selects it, and explains a duplicate name", async () => {
    const user = userEvent.setup();
    createTagAction.mockResolvedValueOnce({
      ok: true,
      data: { id: "t3", name: "Position", category: "custom", created_at: "2026-10-16T10:00:00Z" },
    });
    createTagAction.mockResolvedValueOnce({
      ok: false,
      code: "duplicate_tag_name",
      error: "A tag with that name exists.",
    });
    render(<DrillEditor tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-tag-new"), "Position");
    await user.click(screen.getByTestId("drill-editor-tag-add"));
    const chip = await screen.findByTestId("drill-editor-tag-t3");
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByTestId("drill-editor-tag-new"), "aim");
    await user.click(screen.getByTestId("drill-editor-tag-add"));
    expect(await screen.findByTestId("drill-editor-tag-new-error")).toHaveTextContent(
      'There is already a tag called "aim".',
    );
  });

  it("keeps a chip toggled while a new tag is still being created", async () => {
    const user = userEvent.setup();
    let finish: (value: ApiResult<TagRead>) => void = () => {};
    createTagAction.mockReturnValueOnce(
      new Promise<ApiResult<TagRead>>((resolve) => {
        finish = resolve;
      }),
    );
    render(<DrillEditor tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-tag-new"), "Position");
    await user.click(screen.getByTestId("drill-editor-tag-add"));
    // The request is in flight: toggle another tag now.
    await user.click(screen.getByTestId("drill-editor-tag-t2"));
    expect(screen.getByTestId("drill-editor-tag-t2")).toHaveAttribute("aria-pressed", "true");

    finish({
      ok: true,
      data: { id: "t3", name: "Position", category: "custom", created_at: "2026-10-16T10:00:00Z" },
    });

    expect(await screen.findByTestId("drill-editor-tag-t3")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("drill-editor-tag-t2")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the empty tag state", () => {
    render(<DrillEditor tags={[]} />);
    expect(screen.getByTestId("drill-editor-tags-empty")).toBeInTheDocument();
  });
});

describe("DrillEditor, editing", () => {
  it("starts clean: nothing to save or discard", () => {
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    expect(screen.getByTestId("drill-editor-save")).toBeDisabled();
    expect(screen.getByTestId("drill-editor-discard")).toBeDisabled();
    expect(screen.getByTestId("drill-editor-subtitle")).toHaveTextContent("Editing v2");
    expect(screen.getByTestId("drill-editor-tag-t1")).toHaveAttribute("aria-pressed", "true");
  });

  it("says a new version is made only when layout, instructions or scoring change", async () => {
    const user = userEvent.setup();
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), " (new)");
    expect(screen.getByTestId("drill-editor-save")).toHaveTextContent("Save");
    expect(screen.getByTestId("drill-editor-save")).not.toHaveTextContent("v3");
    expect(screen.getByTestId("drill-editor-subtitle")).toHaveTextContent("keeps v2");

    await user.type(screen.getByTestId("drill-editor-instructions"), " Slowly.");
    expect(screen.getByTestId("drill-editor-save")).toHaveTextContent("Save v3");
    expect(screen.getByTestId("drill-editor-subtitle")).toHaveTextContent("saving creates v3");
  });

  it("sends the base version id with the edit and opens the drill", async () => {
    const user = userEvent.setup();
    updateDrillAction.mockResolvedValue(ok(DRILL));
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), "!");
    await user.click(screen.getByTestId("drill-editor-save"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/drills/d1"));
    const [id, body] = updateDrillAction.mock.calls[0];
    expect(id).toBe("d1");
    expect(body.base_drill_version_id).toBe("v2");
    expect(body.title).toBe("30-degree cut!");
    expect(body.tag_ids).toEqual(["t1"]);
  });

  it("puts the API's problems next to their fields and can select the ball", async () => {
    const user = userEvent.setup();
    updateDrillAction.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      error: "The drill is invalid.",
      details: [
        { code: "balls_overlap", message: "m", path: ["layout", "object_balls", 1] },
        { code: "pass_threshold_too_high", message: "pass_threshold can be at most 10.", path: ["scoring", "pass_threshold"] },
      ],
    } satisfies ApiResult<DrillRead>);
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), "!");
    await user.click(screen.getByTestId("drill-editor-save"));

    const banner = await screen.findByTestId("drill-editor-problems");
    expect(banner).toHaveTextContent("2 problems to fix before saving");
    expect(screen.getByTestId("drill-editor-problem-0")).toHaveTextContent("Ball 2 overlaps another ball.");
    expect(screen.getByTestId("drill-editor-problem-0")).toHaveTextContent("layout.object_balls[1] · balls_overlap");
    expect(screen.getByTestId("drill-editor-scoring-pass_threshold-error")).toHaveTextContent(
      "Makes to pass can be at most 10.",
    );

    await user.click(screen.getByTestId("drill-editor-problem-action-0"));
    expect(screen.getByTestId("table-editor-selection")).toHaveTextContent("Ball 2");

    await user.click(screen.getByTestId("drill-editor-problem-action-1"));
    await waitFor(() =>
      expect(screen.getByTestId("drill-editor-scoring-pass_threshold")).toHaveFocus(),
    );
  });

  it("clears the API's problems once the person edits", async () => {
    const user = userEvent.setup();
    updateDrillAction.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      error: "x",
      details: [{ code: "schema_invalid", message: "m", path: ["title"] }],
    } satisfies ApiResult<DrillRead>);
    render(<DrillEditor drill={DRILL} tags={TAGS} />);
    await user.type(screen.getByTestId("drill-editor-title"), "!");
    await user.click(screen.getByTestId("drill-editor-save"));
    await screen.findByTestId("drill-editor-problems");

    await user.type(screen.getByTestId("drill-editor-title"), "?");

    expect(screen.queryByTestId("drill-editor-problems")).toBeNull();
  });

  it("explains a stale version instead of overwriting, and keeps the edits", async () => {
    const user = userEvent.setup();
    updateDrillAction.mockResolvedValue({
      ok: false,
      code: "stale_version",
      error: "The drill changed.",
    } satisfies ApiResult<DrillRead>);
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), "!");
    await user.click(screen.getByTestId("drill-editor-save"));

    const panel = await screen.findByTestId("drill-editor-stale");
    expect(panel).toHaveTextContent("saved somewhere else");
    expect(screen.getByTestId("drill-editor-stale-reload")).toHaveAttribute("href", "/drills/d1/edit");
    expect(screen.getByTestId("drill-editor-title")).toHaveValue("30-degree cut!");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an error that has no details, such as the API being down", async () => {
    const user = userEvent.setup();
    updateDrillAction.mockResolvedValue({
      ok: false,
      error: "Could not reach the API: connect ECONNREFUSED",
    } satisfies ApiResult<DrillRead>);
    render(<DrillEditor drill={DRILL} tags={TAGS} />);

    await user.type(screen.getByTestId("drill-editor-title"), "!");
    await user.click(screen.getByTestId("drill-editor-save"));

    expect(await screen.findByTestId("drill-editor-error")).toHaveTextContent("Could not reach the API");
  });

  it("discards back to the saved drill", async () => {
    const user = userEvent.setup();
    render(<DrillEditor drill={DRILL} tags={TAGS} />);
    await user.type(screen.getByTestId("drill-editor-title"), " edited");
    expect(screen.getByTestId("drill-editor-save")).toBeEnabled();

    await user.click(screen.getByTestId("drill-editor-discard"));

    expect(screen.getByTestId("drill-editor-title")).toHaveValue("30-degree cut");
    expect(screen.getByTestId("drill-editor-save")).toBeDisabled();
  });

  describe("settings tabs", () => {
    function setPhone(isPhone: boolean) {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: isPhone,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("is plain sections, with no tab roles on the panels, on a desktop", () => {
      setPhone(false);
      render(<DrillEditor drill={DRILL} tags={TAGS} />);

      for (const id of ["details", "scoring", "notes"]) {
        expect(screen.getByTestId(`drill-editor-panel-${id}`)).not.toHaveAttribute("role");
      }
    });

    it("wires each tab to its panel on a phone, and opens one panel at a time", async () => {
      const user = userEvent.setup();
      setPhone(true);
      render(<DrillEditor drill={DRILL} tags={TAGS} />);

      const detailsTab = screen.getByTestId("drill-editor-tab-details");
      const scoringTab = screen.getByTestId("drill-editor-tab-scoring");
      expect(detailsTab).toHaveAttribute("aria-controls", "drill-editor-panel-details");
      expect(detailsTab).toHaveAttribute("tabindex", "0");
      expect(scoringTab).toHaveAttribute("tabindex", "-1");
      const scoringPanel = screen.getByTestId("drill-editor-panel-scoring");
      expect(scoringPanel).toHaveAttribute("role", "tabpanel");
      expect(scoringPanel).toHaveAttribute("aria-labelledby", "drill-editor-tab-scoring");
      expect(scoringPanel).toHaveAttribute("data-active", "false");
      const detailsPanel = screen.getByTestId("drill-editor-panel-details");
      expect(detailsPanel).toHaveAttribute("data-active", "true");

      await user.click(scoringTab);

      expect(scoringTab).toHaveAttribute("aria-selected", "true");
      expect(scoringPanel).toHaveAttribute("data-active", "true");
      expect(detailsPanel).toHaveAttribute("data-active", "false");
    });

    it("moves between tabs with the arrow, Home and End keys", async () => {
      const user = userEvent.setup();
      setPhone(true);
      render(<DrillEditor drill={DRILL} tags={TAGS} />);
      const tab = (id: string) => screen.getByTestId(`drill-editor-tab-${id}`);

      tab("details").focus();
      await user.keyboard("{ArrowRight}");
      expect(tab("scoring")).toHaveFocus();
      expect(tab("scoring")).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{ArrowRight}");
      expect(tab("notes")).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(tab("details")).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      expect(tab("notes")).toHaveFocus();

      await user.keyboard("{Home}");
      expect(tab("details")).toHaveFocus();

      await user.keyboard("{End}");
      expect(tab("notes")).toHaveFocus();
    });
  });
});
