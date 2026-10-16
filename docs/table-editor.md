# Table editor design note

Design for the `TableEditor` component (`apps/web/components/table-editor/`), built on layout schema v2 (ADR 0008) in the build order of `docs/architecture.md` section 4.8. Jira: CUE-21. It replaces the first attempt (CUE-11), which edited layout v1.

## Contract

`TableEditor` takes `{ layout, onChange, readOnly }` and never fetches data.

- **Controlled.** The parent owns the layout. The editor never mutates `layout`; every change, including undo, redo, reset and mirror, is reported as a whole new layout through `onChange(next)`.
- **Read-only.** `readOnly` draws the same table with no toolbar, handlers or focus. The drill detail and session screens use it.
- **Writes v2 only.** `schema_version` and `table` pass through untouched. Optional parts (`landing_zone`, `cue_spin`, `target_pocket`) are dropped from the JSON when unset, never written as `null`.
- **Types** come from `lib/api-client.ts` (`DrillLayout`). The constants in `lib/layout.ts` mirror `apps/api/app/services/layout_service.py`.

## What can be edited

| Part | How |
|---|---|
| Cue ball (`ball_0`) | Drag, or arrow keys. Cannot be deleted. |
| Object balls (up to 15) | Ball tool: click the table to place one, or press Enter on the table to place one at a free spot. Drag, arrow keys, Delete. |
| Landing zone | Landing zone tool: click to place it (fixed radius 0.5), or Enter to place it at the centre. Drag, arrow keys, Delete. |
| Target pocket | Pocket target tool: click a pocket. Any pocket can be focused and toggled with Enter. One per drill. |
| Cue spin | The cue ball face under the table: click or drag the hit point, arrow keys, Delete or "Clear spin". |

## Coordinates

- **viewBox:** `-0.45 -0.45 8.9 4.9`: the 8 by 4 playing surface plus a 0.45 rail band. The head rail (`x = 0`) is on the left.
- **Pointer to table units:** `clientToTable` maps the svg's bounding rect onto the viewBox. The svg keeps its aspect ratio, so no matrix maths is needed.
- **Ball radius** is 0.09 (2.25 in over one diamond of 12.5 in), drawn at true scale.

## Placement rules

Pure helpers in `lib/table-geometry.ts` and `lib/layout-edits.ts`, tested in the matching `*.test.ts`.

- **Drag order:** snap (0.05, toggleable) then clamp to the cushions then resolve overlap then round to 3 decimals.
- **Frozen balls:** a ball may touch a cushion or another ball exactly, and the 0.002 validation tolerance applies.
- **Overlap:** a ball dropped on another is pushed out along the line between centres until they touch. If that leaves the table or hits a third ball, it keeps its last valid position.
- **Arrow keys** move 0.05, or 0.01 with Shift, without snapping.
- **Mirror H** is `x -> 8 - x` and **Mirror V** is `y -> 4 - y`; pocket names swap. Both mirrors are reflections, so left and right spin swap: `cue_spin.x` is negated and `cue_spin.y` (follow and draw) is unchanged. Each is its own inverse.
- **Ids:** a new ball gets `ball_<n>` one above the highest existing id. Ids are never renumbered.

## Undo and redo

`lib/layout-history.ts` is a pure reducer: `{ past, present, future, baseline }`, at most 100 undo steps. One gesture (a whole drag, one key press) is one step, because a drag edits a draft and commits on pointer up. Reset commits the layout the editor was given as a new, undoable step. A layout from the parent that the editor did not produce replaces the history, so the parent never manages it.

## Keyboard and screen readers

- Balls, the landing zone and every pocket are focusable buttons: Enter or Space selects (or toggles the pocket), arrows nudge, Delete removes, Escape clears the tool or selection.
- Ctrl or Cmd with Z undoes; with Shift, or Ctrl+Y, redoes.
- After adding a ball or the zone with the keyboard, focus moves to it.
- The selection bar is a `role="status"` region; the table has a spoken summary as its name.
- The global `:focus-visible` rule is unlayered and beats Tailwind's `outline-none`, so the editor switches the default outline off inline on SVG groups and draws its own dashed focus ring.

## Phone

- **Touch model.** Tap a ball (or the landing zone) to select it, then drag. Chromium only honours `touch-action` on the `<svg>` itself, not on shapes inside it, so the table stops panning only while something is selected or a tool is active. With nothing selected, a swipe on the felt scrolls the page; tapping the felt deselects. `e2e/table-editor.spec.ts` checks this with real touch swipes.
- **Size.** At 375 px a ball is about 3.5 px in radius, so touch targets for balls are enlarged (hit radius 0.2, about 8 px) but still far below 44 px. Tap near a ball to select it; for exact placement use the arrow keys or drag. On-screen nudge buttons are a possible follow-up.
- The tool row scrolls sideways; the page never does.

## Contract with the API

`fixtures/layouts/editor-layouts.json` holds layouts built with these helpers (a ball touching a cushion, two balls exactly touching, 15 balls, mirrored layouts and so on). `apps/web/lib/editor-layouts.test.ts` regenerates them and fails if they change; `apps/api/tests/test_editor_layout_fixtures.py` validates each with the API's layout service. Regenerate with `UPDATE_EDITOR_LAYOUTS=1 pnpm --filter web test`.

## Dev preview

`/dev/table-editor` (404 in production) shows the editor, a read-only copy and the live layout JSON. The Playwright specs in `apps/web/e2e/table-editor.spec.ts` use it.

## Not yet

- Mapping API layout errors onto the editor (the drill editor ticket owns that).
- On-screen nudge buttons for phones.
- Generating the layout types from the API's JSON Schema.
