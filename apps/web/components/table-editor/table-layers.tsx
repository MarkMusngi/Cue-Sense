import type { KeyboardEvent, PointerEvent } from "react";

import type { DrillLayout, PocketName } from "@/lib/api-client";
import { ballColor } from "@/lib/ball-colors";
import { LANDING_ZONE_RADIUS, POCKET_NAMES, POCKETS, TABLE_LENGTH, TABLE_WIDTH } from "@/lib/layout";
import { ballLabel } from "@/lib/layout-ids";

import { TableSurface } from "../table-surface";
import { ballTestId, LANDING_ZONE_ID, type Tool } from "./editor-state";

// Physical colours on the felt, the same in both themes: an ivory ring marks the
// selection, light blue marks keyboard focus.
const SELECTION = "#F2EEE4";
const FOCUS = "#9CD1FF";
// The global :focus-visible rule is unlayered and beats Tailwind's outline-none, so the
// default outline (a box round the whole svg group) is switched off inline; FocusRing
// and the place rect draw the focus indicator instead.
const NO_OUTLINE = { outline: "none" } as const;
const TARGET = { fill: "rgba(233,196,106,0.22)", stroke: "#E9C46A" };

export type LayerHandlers = {
  onBallPointerDown: (event: PointerEvent<SVGGElement>, id: string) => void;
  onBallKeyDown: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  onZonePointerDown: (event: PointerEvent<SVGGElement>) => void;
  onZoneKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  onPocketPointerDown: (event: PointerEvent<SVGGElement>, pocket: PocketName) => void;
  onPocketKeyDown: (event: KeyboardEvent<SVGGElement>, pocket: PocketName) => void;
  onPlaceKeyDown: (event: KeyboardEvent<SVGRectElement>) => void;
};

type TableLayersProps = {
  layout: DrillLayout;
  radius: number;
  selected: string | null;
  tool: Tool;
  /** Leave out for a read-only drawing: no handlers, nothing focusable. */
  handlers?: LayerHandlers;
};

const PLACE_LABEL: Partial<Record<Tool, string>> = {
  ball: "Add a ball",
  zone: "Place the landing zone",
};

function pocketLabel(pocket: PocketName, isTarget: boolean): string {
  return `${pocket.replace("_", " ")} pocket${isTarget ? ", target" : ""}`;
}

function FocusRing({ r }: { r: number }) {
  return (
    <circle
      r={r}
      fill="none"
      stroke={FOCUS}
      strokeWidth="0.03"
      strokeDasharray="0.06 0.04"
      className="opacity-0 group-focus-visible:opacity-100"
    />
  );
}

/** Table, target pocket, landing zone and balls, in diamond units. */
export function TableLayers({ layout, radius, selected, tool, handlers }: TableLayersProps) {
  const interactive = handlers !== undefined;
  const placeLabel = PLACE_LABEL[tool];
  const hitRadius = Math.max(radius * 2.2, 0.2);

  return (
    <>
      <TableSurface detailed />

      {interactive && placeLabel && (
        <rect
          x="0"
          y="0"
          width={TABLE_LENGTH}
          height={TABLE_WIDTH}
          fill="transparent"
          stroke="none"
          strokeWidth="0.04"
          tabIndex={0}
          role="button"
          aria-label={placeLabel}
          data-testid="table-editor-place"
          style={NO_OUTLINE}
          className="focus-visible:[stroke:#9CD1FF]"
          onKeyDown={handlers.onPlaceKeyDown}
        />
      )}

      {POCKET_NAMES.map((pocket) => {
        const { x, y } = POCKETS[pocket];
        const isTarget = layout.target_pocket === pocket;
        const ring = (
          <circle
            r="0.33"
            fill="none"
            stroke={TARGET.stroke}
            strokeWidth="0.04"
            strokeDasharray="0.09 0.05"
            opacity={isTarget ? 1 : 0}
          />
        );
        if (!interactive) {
          return isTarget ? (
            <g key={pocket} transform={`translate(${x} ${y})`}>
              {ring}
            </g>
          ) : null;
        }
        return (
          <g
            key={pocket}
            transform={`translate(${x} ${y})`}
            role="button"
            tabIndex={0}
            aria-pressed={isTarget}
            aria-label={pocketLabel(pocket, isTarget)}
            data-testid={`table-editor-pocket-${pocket.replace("_", "-")}`}
            style={NO_OUTLINE}
            className="group cursor-pointer"
            onPointerDown={(event) => handlers.onPocketPointerDown(event, pocket)}
            onKeyDown={(event) => handlers.onPocketKeyDown(event, pocket)}
          >
            <circle r="0.4" fill="transparent" />
            {ring}
            <FocusRing r={0.42} />
          </g>
        );
      })}

      {layout.landing_zone && (
        <g
          transform={`translate(${layout.landing_zone.x} ${layout.landing_zone.y})`}
          data-testid="table-editor-landing-zone"
          {...(interactive
            ? {
                role: "button",
                tabIndex: 0,
                "aria-pressed": selected === LANDING_ZONE_ID,
                "aria-label": `Landing zone at x ${layout.landing_zone.x.toFixed(2)}, y ${layout.landing_zone.y.toFixed(2)}`,
                style: NO_OUTLINE,
                className: "group cursor-grab",
                onPointerDown: handlers.onZonePointerDown,
                onKeyDown: handlers.onZoneKeyDown,
              }
            : {})}
        >
          <circle
            r={LANDING_ZONE_RADIUS}
            fill={TARGET.fill}
            stroke={TARGET.stroke}
            strokeWidth="0.04"
            strokeDasharray="0.09 0.05"
          />
          {selected === LANDING_ZONE_ID && (
            <circle r={LANDING_ZONE_RADIUS + 0.04} fill="none" stroke={SELECTION} strokeWidth="0.025" />
          )}
          {interactive && <FocusRing r={LANDING_ZONE_RADIUS + 0.08} />}
        </g>
      )}

      {[layout.cue_ball, ...layout.object_balls].map((ball) => {
        const isSelected = selected === ball.id;
        return (
          <g
            key={ball.id}
            transform={`translate(${ball.x} ${ball.y})`}
            data-testid={`table-editor-ball-${ballTestId(ball.id)}`}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": isSelected,
                  "aria-label": `${ballLabel(ball.id)} at x ${ball.x.toFixed(2)}, y ${ball.y.toFixed(2)}`,
                  style: NO_OUTLINE,
                  className: "group cursor-grab",
                  onPointerDown: (event: PointerEvent<SVGGElement>) =>
                    handlers.onBallPointerDown(event, ball.id),
                  onKeyDown: (event: KeyboardEvent<SVGGElement>) =>
                    handlers.onBallKeyDown(event, ball.id),
                }
              : {})}
          >
            {interactive && <circle r={hitRadius} fill="transparent" />}
            <circle
              r={radius}
              fill={ballColor(ball.id)}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="0.012"
            />
            {isSelected && <circle r={radius + 0.07} fill="none" stroke={SELECTION} strokeWidth="0.025" />}
            {interactive && <FocusRing r={radius + 0.13} />}
          </g>
        );
      })}
    </>
  );
}
