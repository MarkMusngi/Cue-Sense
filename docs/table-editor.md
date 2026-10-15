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

## As built

- **Tools:**
  - **Select** picks and drags balls, zones and annotations.
  - **Add ball** places balls and stays on, so you can place several; Escape goes back to Select.
  - **Pocket target** picks the pocket nearest the click. It links the selected object ball, if one is selected.
  - **Circle zone, Rect zone and Text** place one element, then switch back to Select.
  - **Arrow and Line** add a point per click. Click the last point again or press Enter to finish; Escape cancels.
- **Which tool grabs what:** balls can be grabbed only with Select or Add ball, so an aim line can start on the cue ball. Targets and annotations can be picked only with Select, so a click on a zone with another tool places on top of the zone.
- **Actions:**
  - Snap, Undo, Redo, Reset and Delete.
  - Mirror H and Mirror V, both undoable.
  - Keyboard: Delete or Backspace, Escape, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y.
- **Inspector row:** a fixed-height row under the toolbar. It shows drawing help while a path is being drawn, a target's ball and a zone's label, or an annotation's label or text. Its height never changes, so the table never moves under the pointer.
- **Removing a ball:** targets that named it keep their place but lose the link. A pocket target then means any ball.
- **Text:** a new text note opens with its text box focused and "Note" selected. The pointerdown's default is prevented so the browser does not move focus back to the table.
- **Touch:**
  - `touch-action: none` on the editable table.
  - Larger invisible hit areas for balls (1.6 × radius), handles and path points.
  - One pointer at a time; a lost pointer capture cancels the drag.
  - At phone width a ball is about 3.5 px in radius, so even the enlarged hit area is far below a 44 px touch target. Editing works best in landscape or on a tablet.
- **Head string:** when the cue ball is in hand behind the head string, dragging or nudging it stops at `x = 2`.
- **Keyboard:**
  - Arrow keys nudge the selection by one grid step, or by 0.01 with Shift. Each nudge is one undo step.
  - Balls carry an `aria-label` with their position.
  - Selecting an element still needs a pointer. Keyboard selection is a follow-up.
- **Several commits in one event:** an inspector input saves on blur. The pointerdown that blurs it then starts a gesture in the same event, so `useLayoutHistory` keeps the newest history in a ref. Editor handlers read `getPresent()` or commit an updater, so the second commit builds on the first and no edit is lost.
- **Dev preview:** `/dev/table-editor` shows the editor, a ball-in-hand selector (a stand-in for the drill form), a read-only thumbnail and the live layout JSON.

## Not yet

- **Generated types:** the layout types could be generated from the Pydantic models' JSON Schema to prevent drift.
- **CI:** web unit tests run with `pnpm --filter web test`. Adding them to the CI web job needs an explicit go-ahead (`AGENTS.md` §11).
