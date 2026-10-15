# 0008: Simplified layout schema v2

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-12
- **Deviates from:** `docs/architecture.md` sections 4.3 (layout JSON) and 4.8 (table editor build order)

## Context

Setting up a drill should be as simple as dragging balls onto the table. Layout schema v1 asks for more than the owner wants to author: a ball-in-hand mode on the cue ball, optional ball numbers, pocket and circle or rect zone targets, and arrow, line and text annotations. The table editor (CUE-11, in review) builds tools for all of them.

The owner wants only: draggable balls, one landing zone, a cue ball spin hit point drawn like the 8-ball-pool diagram, and one target pocket. Drill versions are immutable (README decision 2), and ADR 0002 says stored documents are never rewritten and are upgraded on read. The five seed drills and any drill saved so far are v1.

## Decision

Add `schema_version` 2 and make it the latest. v1 stays in the codebase only as an input shape for the upgrade function.

```json
{
  "schema_version": 2,
  "table": { "kind": "pool", "size_ft": 9 },
  "cue_ball": { "id": "ball_0", "x": 2.0, "y": 2.0 },
  "object_balls": [{ "id": "ball_1", "x": 5.5, "y": 1.2 }],
  "landing_zone": { "x": 3.0, "y": 2.0 },
  "cue_spin": { "x": 0.0, "y": -0.4 },
  "target_pocket": "top_right"
}
```

- **Balls:** a position and an id. No `ball_in_hand` and no `number`. Ids keep the `ball_<n>` scheme and the cue ball stays `ball_0`. Bounds, overlap and ball-count rules are unchanged.
- **`landing_zone`:** optional, one per layout, a fixed-size circle centred on `x`, `y`. The radius is 0.5 diamonds, a constant in code, so it is not stored and cannot be resized. Only the centre must be on the table, the same rule v1 circle zones had, so every valid v1 layout upgrades to a valid v2 layout.
- **`cue_spin`:** optional hit point on the cue ball face. `x` is side (-1 left, 1 right) and `y` is vertical (-1 bottom, 1 top), with `x² + y² <= 1`.
- **`target_pocket`:** optional, one of the six pocket names. One per drill, and it applies to the drill rather than to a named ball.
- Targets, zones other than `landing_zone`, and annotations do not exist in v2.

**Upgrade v1 to v2** is a pure function in the layout service, run on read per ADR 0002. It is lossy and documented as such:

- `ball_in_hand` and ball numbers are dropped; the cue ball keeps its position.
- The first pocket target becomes `target_pocket`.
- The first zone becomes `landing_zone`, centred on the circle's centre or the rect's centre.
- Other targets, all annotations and `label` fields are dropped.

Reads (API responses, duplicating a drill, the editor) see v2. Writes accept only v2. Stored rows are never changed. Saving a drill compares the incoming layout with the upgraded stored one, so resaving an old drill unchanged adds no version. The seed script emits v2; drills already seeded in a database stay v1 and are upgraded on read.

## Alternatives considered

- **Keep v1 and only hide tools in the editor:** nothing to migrate, but the schema keeps concepts nobody authors, and "one landing zone, one pocket" cannot be enforced.
- **Rewrite stored v1 rows in a migration:** rejected by ADR 0002; it mutates immutable versions.
- **Resizable landing zone:** needs a stored radius and bounds rules. Fixed size can be revisited with a v3.

## Consequences

- A drill cannot express "place the cue ball anywhere", bank paths, written notes on the table, or several pockets. The five-ball run-out loses its multi-ball intent. This is accepted for now; richer drills need a later schema version.
- The v1 models and fixture stay for the upgrade tests and are never deleted (ADR 0002).
- Several v1 error codes (`duplicate_ball_number`, `cue_ball_not_behind_head_string`, `unknown_ball_reference`, `pocket_target_cue_ball`, `too_many_annotations`) have no v2 equivalent and are removed. No new codes are added: spin and pocket mistakes are `schema_invalid`, and a landing zone centre off the table is `position_out_of_bounds`.
- The table editor (CUE-11) must stop emitting v1 and drop its target, annotation and ball-in-hand tools. That is follow-up work, ticketed separately.
