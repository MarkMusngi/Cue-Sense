# 0004: Drop attempts.observations

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-4
- **Deviates from:** `docs/architecture.md` §1.2 (reserved nullable `observations` column)

## Context

Architecture §1.2 reserved a nullable `attempts.observations` JSONB column for computer vision output. The Phase 4+ design also has a `shot_observations` table for the same data, so there were two places for one thing. Vision finds shots in a video before it knows which attempt they belong to. One attempt can also have observations from several cameras or several pipeline versions. A single column on `attempts` can't represent either case. See finding 14 in `docs/architecture-review.md`.

## Decision

Do not create `attempts.observations`. Vision output will live only in `shot_observations`, created in Phase 4. Each row belongs to a video and an analysis job, covers a time range, and has a nullable `attempt_id` plus a `link_method`.

To make that link possible later, `attempts` gets `tapped_at` (client time) now, alongside `recorded_at` (server time), and `drills` gets `slug` so clip names and `manifest.csv` can be joined to drills.

README decision 9 is unchanged. Its wording ("reserved columns and tables are the only preparation") permits this but does not require a column.

## Alternatives considered

- **Keep the column as a summary of `shot_observations`:** the summary would go stale and has no defined shape yet.
- **Keep the column as the only store:** can't hold several cameras, re-runs or shots not yet matched to an attempt.

## Consequences

- One fewer column that would otherwise collect undefined data.
- If a per-attempt summary is ever needed, adding a nullable column later is a harmless migration.
- `AGENTS.md` §4 no longer cites `attempts.observations` as its example of a reserved column.
- `docs/prompts.md` (Prompt 3) still asks for `attempts.observations` and should be updated before it is run.
