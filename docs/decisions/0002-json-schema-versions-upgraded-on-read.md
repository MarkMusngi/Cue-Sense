# 0002: Layout and scoring JSON upgraded on read

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-4
- **Deviates from:** README "Decisions: safe to change" (layout kinds line: "bump `schema_version` and add a migration")

## Context

Layout and scoring are JSONB documents on `drill_versions`, and README decision 2 makes drill versions immutable. Rewriting stored JSON in an Alembic migration whenever `schema_version` changes conflicts with that. It also risks old layouts failing newer, stricter validation rules. The scoring JSON originally had no `schema_version` at all. See findings 5 and 6 in `docs/architecture-review.md`.

## Decision

Layout and scoring JSON both carry `schema_version`.

- Stored documents are never rewritten, and never re-validated against rules newer than the version they were saved with.
- `layout_service` and the scoring service hold pure upgrade functions (v1 to v2, v2 to v3, and so on). They run on read, so the API and the rest of the backend only ever see the latest version.
- Writes accept only the latest `schema_version`.
- Each historical version keeps a test fixture that must upgrade cleanly.

A bulk rewrite of stored JSON is allowed only if upgrading on read becomes a measured performance problem, and needs its own ADR.

## Alternatives considered

- **Alembic data migrations that rewrite JSONB:** a single code path at read time, but it mutates immutable versions, is hard to roll back, and can corrupt history if a migration has a bug.
- **Version-specific code paths throughout the app:** no upgrade step, but every consumer has to handle every version forever.

## Consequences

- Adding a layout kind or scoring kind means bumping `schema_version` and adding an upgrade function and fixture, not a migration.
- Upgrade functions must be pure and total, and are never deleted.
- The README "safe to change" lines are reworded. `CLAUDE.md` does not mirror that list, so it is unchanged.
