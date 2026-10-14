# 0003: Head rail at x = 0

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-4
- **Deviates from:** README "Decisions: do not change", decision 1

## Context

README decision 1 fixes diamond units with the origin "at the top-left of the playing surface". A table looks the same rotated 180°, and the same when mirrored along its long axis, so "top-left" names no physical corner. Layouts need a physical frame for "ball in hand behind the head string". Camera calibration in Phase 4 needs one to map pixels to table coordinates without ambiguity. See finding 13 in `docs/architecture-review.md`.

## Decision

- `x = 0` is the head rail, so the head string is at `x = 2` and the foot spot at `(6, 2)`.
- `y = 0` is the long rail on your left when standing at the head rail facing the foot rail.
- Diagrams draw the head rail on the left, so the origin stays at the top-left and existing pocket names (`top_left` and so on) keep their meaning.

Units, ranges and "never store pixels" are unchanged. README decision 1 gains one sentence stating the anchor.

## Alternatives considered

- **Leave orientation undefined:** no wording change, but `behind_head_string` can't be validated, and calibration would need per-setup guesswork.
- **x = 0 at the foot rail:** equally valid, but the head end is where the break and ball in hand happen, so putting it at the origin keeps the common numbers small (kitchen is `x <= 2`).

## Consequences

- Layout validation can check `behind_head_string` as `x <= 2`.
- Calibration clips must show which end is the head rail (`docs/architecture.md` §8).
- The editor's mirror tool can swap head and foot. That is intended: a mirrored copy is a new drill.
- README decision 1, `CLAUDE.md` and `AGENTS.md` §9 are updated together.
