# 0005: Role-prefixed foreign keys and kind as the discriminator key

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-4
- **Deviates from:** README "Naming conventions" (foreign keys row) and "Decisions: safe to change" (`scoring.type`)

## Context

The README foreign key rule is "singular table name + `_id`", and it allows no exceptions. Yet README decision 4 requires `owner_id`, which references `users`, so the README contradicts itself. The schema also needs a table referenced in a specific role: the current version of a drill, or the version a drill was duplicated from.

Separately, the JSON used `type` for `table` and `scoring` but `kind` for targets and annotations. That is two styles for one job, and `type` shadows a Python builtin. See findings 18 and 20 in `docs/architecture-review.md`.

## Decision

- **Foreign keys:** `<singular table>_id`. When a role matters, prefix it: `<role>_<singular table>_id`, for example `current_drill_version_id` and `source_drill_version_id`. References to `users` are always `owner_id`.
- **JSON discriminators:** `kind` is the only key that says which variant an object is (`table.kind`, `scoring.kind`, `targets[].kind`, `annotations[].kind`).

Both become rows in the README naming table, so there are still no exceptions, only rules.

## Alternatives considered

- **Rename `owner_id` to `owner_user_id`:** fully regular, but changes a column name the README decisions, `AGENTS.md` and future code all depend on.
- **Allow free-form role names (`current_version_id`):** shorter, but the referenced table is no longer visible from the column name.
- **Use `type` everywhere:** shadows Python's `type` in Pydantic models and reads as a type annotation.

## Consequences

- `drills.current_version_id` becomes `current_drill_version_id`, and the README TypeScript example follows.
- `scoring.type` becomes `scoring.kind`, and `table.type` becomes `table.kind`.
- The README naming table and safe-to-change list, `CLAUDE.md` and `AGENTS.md` §3 are updated together.
