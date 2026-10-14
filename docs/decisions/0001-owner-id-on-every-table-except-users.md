# 0001: owner_id on every table except users

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-4
- **Deviates from:** README "Decisions: do not change", decision 4

## Context

README decision 4 says "Every row is owner-scoped with `owner_id`". The original schema in `docs/architecture.md` §4.5 put `owner_id` only on `drills`, `tags` and `practice_sessions`. It left it off `drill_versions`, `drill_tags`, `drill_runs` and `attempts`. Nothing stopped a drill run in one owner's session from pointing at another owner's drill version, or a `drill_tags` row from linking one owner's drill to another owner's tag. Read literally, the decision also covers `users`, which makes no sense: a user is the owner. See finding 1 in `docs/architecture-review.md`.

## Decision

Every table except `users` has `owner_id`, including join tables such as `drill_tags`. `users` has none, because it is the owner.

Foreign keys between owned tables include `owner_id`, for example `drill_runs(owner_id, practice_session_id) → practice_sessions(owner_id, id)`. They are backed by `unique(owner_id, id)` on each parent. A row can therefore never reference another owner's data, and every query can filter on one column without joins.

README decision 4 is reworded to say this explicitly.

## Alternatives considered

- **Owner on aggregate roots only, checked in services:** fewer columns, but a service bug can link data across owners, and the README wording would still be violated.
- **Postgres row-level security:** strong, but adds session-variable plumbing to every connection. It is overkill for a single-user MVP and can be added later on top of this.

## Consequences

- Owner isolation becomes a database guarantee, which tests can check by attempting cross-owner inserts.
- Every insert must supply `owner_id`; services set it from the current user.
- Parent tables carry an extra unique constraint `(owner_id, id)`.
- README decision 4, `CLAUDE.md` and `AGENTS.md` §9 are updated together.
