# Table editor design note

Design for the `TableEditor` component (`apps/web/components/table-editor/`), built in the order in `docs/architecture.md` §4.8. Jira: CUE-11.

## Contract

`TableEditor` takes `{ layout, onChange, readOnly }` and never fetches data.

- **Controlled.** The parent owns the layout. The editor never mutates `layout`; every change is reported as a whole new layout through `onChange(next)`.
- **Read-only.** `readOnly` renders the same SVG without handlers, toolbar or focus. It's the thumbnail and viewer for the library, detail and session screens.
- **Types.** `apps/web/lib/layout.ts` mirrors the API's `DrillLayout` with snake_case keys. The types are hand-written because the API sends `layout` as untyped JSON, so an OpenAPI client cannot generate them. The constants (ball radius, tolerance, pockets) carry a comment pointing to `layout_service.py`.

## Coordinates

- **viewBox:** `-0.45 -0.45 8.9 4.9`. That's the 8 × 4 playing surface in diamond units plus a 0.45-diamond rail band on every side. The head rail (`x = 0`) is on the left.
- **Pointer to table units:** a pointer position becomes table units through `svg.getScreenCTM().inverse()`, so no pixel math leaks into the editor.
- **Values on commit:** positions are rounded to 3 decimals. Snapping uses a 0.05 grid and is on by default.
- **Ball radius:** derived from `table.size_ft` (0.09 on a 9 ft table).
- **Pockets:** fixed in code, never stored in a layout.

## State

Layout content always comes from the `layout` prop or the history. The component keeps only UI state:

```ts
type EditorState = {
  selected_id: string | null;
  tool: "select" | "ball" | "pocket_target" | "circle_zone" | "rect_zone" | "arrow" | "line" | "text";
  is_snapping: boolean;
  drag: { pointer_id: number; element_id: string; offset: Point; draft: Layout } | null;
};
```

- **Dragging:** a drag edits a **draft** copy of the layout so it renders smoothly, and commits once on pointer up. One gesture is one `onChange` and one undo step.
- **New ids:** a new element gets the next free `<kind>_<n>` (`lib/layout-ids.ts`), one above the highest existing n. Ids are never renumbered.
- **Cue ball:** always `ball_0`, and it cannot be deleted.

## Undo and redo

- **Reducer:** history is a pure reducer in `lib/layout-history.ts`, used through a small hook. Its state is `{ past, present, future, baseline }`.
  - `commit` pushes `present` onto `past` and clears `future`. A commit equal to `present` is ignored.
  - `undo` and `redo` move between the stacks.
  - `reset` commits `baseline` as a new, undoable step.
  - `replace` starts a fresh history.
  - `past` holds at most 100 entries.
- **Every change goes out through `onChange`,** including undo, redo and reset.
- **Outside changes:** if the parent passes a layout that isn't the one the editor last emitted, such as after loading another version, the editor treats it as `replace` and clears its history. So the parent never manages history.
- **Keys:** Ctrl/Cmd+Z undoes. Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Delete or Backspace removes the selection. Keys only act while the SVG has focus.

## Placement rules

The pure helpers in `lib/table-geometry.ts` have unit tests in `lib/table-geometry.test.ts`.

- **Drag order:** a dragged ball goes through **snap → clamp to cushions → resolve overlap → round**.
  - Clamping keeps the centre within `[r, 8 − r] × [r, 4 − r]`.
  - Balls may overlap by up to the 0.002 validation tolerance, so frozen balls are allowed.
  - An overlapping ball is pushed out along the line between centres until it touches. If that leaves the table or hits another ball, it keeps its last valid position.
- **Horizontal mirror:**
  - `x → 8 − x`, and pocket names swap left and right.
  - A rect zone's corner becomes `8 − x − width`.
  - It's disabled when the cue ball is in hand behind the head string, because mirroring would move it past the head string.
- **Vertical mirror:** `y → 4 − y`, and pocket names swap top and bottom.
- **Both mirrors** keep ids and are their own inverse.

## Not yet

- **Generated types:** the layout types could be generated from the Pydantic models' JSON Schema to prevent drift.
- **CI:** web unit tests run with `pnpm --filter web test`. Adding them to the CI web job needs an explicit go-ahead (`AGENTS.md` §11).
