# 0007: uuid primary keys

- **Status:** Accepted
- **Date:** 2026-10-15
- **Jira:** CUE-7
- **Deviates from:** none. Adds to `docs/architecture.md` §4.5, which did not specify an id type. Recorded as an ADR because primary key type is expensive to reverse.

## Context

The first version of the core migration (CUE-7) used `bigint` identity ids. Several planned features make ids that only the database can assign awkward:

- The session runner is used from a phone at the table (§4.7) on a possibly flaky connection, and may become a PWA (open decision §7.4). A client that can create its own ids can build a drill run and its attempts before the server answers.
- Attempts already carry a client-generated `Idempotency-Key` uuid (§4.6), so uuids are in the system anyway.
- Ids appear in URLs such as `/drills/{id}` and `/drill-runs/{id}`. Sequential ids leak row counts and are easy to guess, which matters once real authentication arrives in Phase 3.
- Exported data and later footage manifests (§6) are easier to merge without id collisions.

## Decision

Every primary key and every foreign key is a `uuid`.

- Python generates the id on insert (`uuid.uuid4`), so a new row's id is known before flush.
- Each id column also has a `gen_random_uuid()` server default, so raw SQL inserts and the database itself can create rows.

## Alternatives considered

- **`bigint` identity (the first version):** smaller, and inserts are in index order. But the client can't create ids, URLs expose counts, and switching later means rewriting every key and foreign key.
- **uuidv7 (time-ordered):** better index locality than uuid4. But Python 3.12 has no `uuid7()` and Postgres 16 has no `uuidv7()`, so it would need a new dependency. At one user's scale, the locality gain doesn't matter yet.
- **`bigint` primary keys plus a separate public uuid column:** two ids per row and two ways to join, for little gain here.

## Consequences

- Keys and indexes are 16 bytes instead of 8, and random uuid4 values insert in no particular order. Both are negligible at this data volume.
- Tests and fixtures can't assume ids like `1`; they read the generated id instead.
- API path parameters and TypeScript types treat ids as strings.
- Switching to uuidv7 later is a default change only: existing uuid4 values stay valid and no column type changes.
- Migration `6e09d55de2f7` was rewritten in place to use uuids before merge. That is only acceptable because it was never merged and the dev database was rebuilt (see PR #17).
