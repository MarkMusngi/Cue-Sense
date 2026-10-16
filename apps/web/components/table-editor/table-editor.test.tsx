// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DrillLayout } from "@/lib/api-client";

import { TableEditor } from "./table-editor";

// jsdom has no PointerEvent, so pointer events would lose their coordinates.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const START: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
};

/** A parent that owns the layout, like the drill editor will. */
function Harness({
  initial = START,
  onChange,
}: {
  initial?: DrillLayout;
  onChange: (layout: DrillLayout) => void;
}) {
  const [layout, setLayout] = useState(initial);
  return (
    <TableEditor
      layout={layout}
      onChange={(next) => {
        setLayout(next);
        onChange(next);
      }}
    />
  );
}

function lastLayout(onChange: ReturnType<typeof vi.fn>): DrillLayout {
  return onChange.mock.calls[onChange.mock.calls.length - 1][0] as DrillLayout;
}

describe("TableEditor", () => {
  it("draws the balls, six pockets and the toolbar", () => {
    render(<TableEditor layout={START} onChange={() => {}} />);

    expect(screen.getByTestId("table-editor-ball-0")).toBeInTheDocument();
    expect(screen.getByTestId("table-editor-ball-1")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^table-editor-pocket-/)).toHaveLength(6);
    expect(screen.getByTestId("table-editor-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("table-editor-svg")).toHaveAttribute(
      "aria-label",
      "Pool table with the cue ball and 1 object ball",
    );
  });

  it("draws a read-only table with no toolbar and nothing focusable", () => {
    const { container } = render(
      <TableEditor layout={{ ...START, target_pocket: "top_right" }} readOnly />,
    );

    expect(screen.getByTestId("table-editor-readonly")).toHaveAttribute("role", "img");
    expect(screen.queryByTestId("table-editor-toolbar")).toBeNull();
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(container.querySelectorAll("[role=button]")).toHaveLength(0);
  });

  it("selects a ball with Enter and nudges it with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("table-editor-selection")).toHaveTextContent("Ball 1");

    await user.keyboard("{ArrowRight}");
    expect(lastLayout(onChange).object_balls[0]).toEqual({ id: "ball_1", x: 5.55, y: 1.2 });

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(lastLayout(onChange).object_balls[0]).toEqual({ id: "ball_1", x: 5.55, y: 1.21 });
  });

  it("stops a nudge at the cushion instead of leaving the table", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ ...START, object_balls: [{ id: "ball_1", x: 7.91, y: 2 }] }}
        onChange={onChange}
      />,
    );

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("deletes an object ball but never the cue ball", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    screen.getByTestId("table-editor-ball-0").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("table-editor-delete")).toBeDisabled();
    await user.keyboard("{Delete}");
    expect(onChange).not.toHaveBeenCalled();

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{Delete}");
    expect(lastLayout(onChange).object_balls).toEqual([]);
    expect(screen.queryByTestId("table-editor-ball-1")).toBeNull();
  });

  it("undoes and redoes with the buttons and the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByTestId("table-editor-undo")).toBeDisabled();

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("table-editor-undo")).toBeEnabled();

    await user.click(screen.getByTestId("table-editor-undo"));
    expect(lastLayout(onChange)).toEqual(START);
    expect(screen.getByTestId("table-editor-redo")).toBeEnabled();

    await user.click(screen.getByTestId("table-editor-redo"));
    expect(lastLayout(onChange).object_balls[0].x).toBe(5.55);

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{Control>}z{/Control}");
    expect(lastLayout(onChange)).toEqual(START);
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(lastLayout(onChange).object_balls[0].x).toBe(5.55);
  });

  it("resets to the layout it was given", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByTestId("table-editor-reset")).toBeDisabled();

    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.click(screen.getByTestId("table-editor-reset"));

    expect(lastLayout(onChange)).toEqual(START);
  });

  it("adds a ball from the keyboard with the Ball tool, and stops at 15", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByTestId("table-editor-tool-ball"));
    screen.getByTestId("table-editor-place").focus();
    await user.keyboard("{Enter}");

    const added = lastLayout(onChange).object_balls;
    expect(added).toHaveLength(2);
    expect(added[1].id).toBe("ball_2");
    expect(screen.getByTestId("table-editor-selection")).toHaveTextContent("Ball 2");
    // Focus moves to the new ball, so the arrow keys and Delete act on it.
    expect(screen.getByTestId("table-editor-ball-2")).toHaveFocus();

    const full: DrillLayout = {
      ...START,
      object_balls: Array.from({ length: 15 }, (_, i) => ({
        id: `ball_${i + 1}`,
        x: 3 + (i % 5) * 0.8,
        y: 0.6 + Math.floor(i / 5) * 1.2,
      })),
    };
    const onFullChange = vi.fn();
    render(<Harness initial={full} onChange={onFullChange} />);
    await user.click(screen.getAllByTestId("table-editor-tool-ball")[1]);
    screen.getAllByTestId("table-editor-place")[1].focus();
    await user.keyboard("{Enter}");
    expect(onFullChange).not.toHaveBeenCalled();
  });

  it("places and removes the landing zone from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByTestId("table-editor-tool-zone"));
    screen.getByTestId("table-editor-place").focus();
    await user.keyboard("{Enter}");

    expect(lastLayout(onChange).landing_zone).toEqual({ x: 4, y: 2 });
    expect(screen.getByTestId("table-editor-landing-zone")).toHaveFocus();
    expect(screen.getByTestId("table-editor-selection")).toHaveTextContent("Landing zone");
    expect(screen.getByTestId("table-editor-tool-select")).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{ArrowRight}");
    expect(lastLayout(onChange).landing_zone).toEqual({ x: 4.05, y: 2 });

    await user.keyboard("{Delete}");
    expect(lastLayout(onChange).landing_zone).toBeUndefined();
  });

  it("chooses and clears the target pocket from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    screen.getByTestId("table-editor-pocket-top-right").focus();
    await user.keyboard("{Enter}");
    expect(lastLayout(onChange).target_pocket).toBe("top_right");
    expect(screen.getByTestId("table-editor-pocket-top-right")).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");
    expect(lastLayout(onChange).target_pocket).toBeUndefined();
  });

  it("mirrors the layout and flips the spin side", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ ...START, cue_spin: { x: 0.4, y: -0.3 }, target_pocket: "top_right" }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByTestId("table-editor-mirror-h"));
    expect(lastLayout(onChange).cue_ball.x).toBe(6);
    expect(lastLayout(onChange).target_pocket).toBe("top_left");
    expect(lastLayout(onChange).cue_spin).toEqual({ x: -0.4, y: -0.3 });

    await user.click(screen.getByTestId("table-editor-mirror-v"));
    expect(lastLayout(onChange).cue_ball.y).toBe(2);
    expect(lastLayout(onChange).object_balls[0].y).toBe(2.8);
    expect(lastLayout(onChange).target_pocket).toBe("bottom_left");
    expect(lastLayout(onChange).cue_spin).toEqual({ x: 0.4, y: -0.3 });
  });

  it("sets and clears the cue spin with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByTestId("table-editor-spin-text")).toHaveTextContent("Not set");

    screen.getByTestId("table-editor-spin").focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(lastLayout(onChange).cue_spin).toEqual({ x: 0.05, y: -0.05 });

    await user.click(screen.getByTestId("table-editor-spin-clear"));
    expect(lastLayout(onChange).cue_spin).toBeUndefined();
  });

  it("drags a ball, snapping to the grid, as one undo step", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const svg = screen.getByTestId("table-editor-svg");
    // 890 x 490 px maps 1 px to 0.01 diamonds, with the drawing starting at -0.45.
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 890, height: 490, right: 890, bottom: 490 }) as DOMRect;
    const ball = screen.getByTestId("table-editor-ball-1");

    // Ball 1 is at (5.5, 1.2): client (595, 165).
    act(() => {
      fireEvent.pointerDown(ball, { clientX: 595, clientY: 165, pointerId: 1 });
      fireEvent.pointerMove(svg, { clientX: 640, clientY: 165, pointerId: 1 });
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      fireEvent.pointerMove(svg, { clientX: 647, clientY: 168, pointerId: 1 });
      fireEvent.pointerUp(svg, { clientX: 647, clientY: 168, pointerId: 1 });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastLayout(onChange).object_balls[0]).toEqual({ id: "ball_1", x: 6, y: 1.25 });
  });

  it("does not let a dragged ball overlap another", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ ...START, object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }, { id: "ball_2", x: 4, y: 3 }] }}
        onChange={onChange}
      />,
    );
    const svg = screen.getByTestId("table-editor-svg");
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 890, height: 490, right: 890, bottom: 490 }) as DOMRect;

    // Drag ball 1 onto ball 2 at (4, 3): client (445, 345).
    act(() => {
      fireEvent.pointerDown(screen.getByTestId("table-editor-ball-1"), {
        clientX: 595,
        clientY: 165,
        pointerId: 1,
      });
      fireEvent.pointerMove(svg, { clientX: 445, clientY: 345, pointerId: 1 });
      fireEvent.pointerUp(svg, { clientX: 445, clientY: 345, pointerId: 1 });
    });

    const [moved, other] = lastLayout(onChange).object_balls;
    expect(other).toEqual({ id: "ball_2", x: 4, y: 3 });
    expect(Math.hypot(moved.x - other.x, moved.y - other.y)).toBeGreaterThanOrEqual(0.18 - 0.002);
  });

  it("replaces its history when the parent passes a different layout", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TableEditor layout={START} onChange={onChange} />);
    screen.getByTestId("table-editor-ball-1").focus();
    await user.keyboard("{ArrowRight}");
    // The parent ignores onChange and loads another drill version.
    const other = { ...START, cue_ball: { id: "ball_0", x: 1, y: 1 } };
    rerender(<TableEditor layout={other} onChange={onChange} />);

    expect(screen.getByTestId("table-editor-undo")).toBeDisabled();
    expect(screen.getByTestId("table-editor-ball-0")).toHaveAttribute(
      "aria-label",
      "Cue ball at x 1.00, y 1.00",
    );
  });
});
