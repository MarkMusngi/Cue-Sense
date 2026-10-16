# Prompts

Use these in Claude Code, one at a time. Review the diff and commit after each. Every prompt asks for a plan before code so you stay in control. Naming rules and locked decisions are in `README.md`; the design is in `docs/architecture.md`.

**Workflow for every prompt.** Each one runs as its own Jira ticket in project `CUE`, on its own branch and pull request, as described in `AGENTS.md` sections 5 and 6. The prompt numbers here are for this file only: do not put "Prompt N" in Jira tickets, branch names or PR titles.

## Status

Last checked against `main` at the merge of the Playwright harness (CUE-19), plus the table editor (CUE-21).

| Prompt | Status | Notes |
|---|---|---|
| 0 Project context file | Done | `CLAUDE.md` and `AGENTS.md` |
| 1 Architecture review | Done | `docs/architecture-review.md`, ADRs 0001 to 0007 |
| 2 Scaffold, Phase 0 | Done | |
| 3 Database models and migration | Done | |
| 4 Layout validation service | Done | Rules are now layout schema v2 (CUE-12, ADR 0008) |
| 5 Drill CRUD API | Done | CUE-10 |
| 6 Table editor component | Done | CUE-21, on layout v2 (`docs/table-editor.md`). PR 21 (CUE-11, layout v1) was closed and replaced |
| 7 Drill editor and detail screens | Done | Library (CUE-15), editor and detail (CUE-26, `docs/drill-editor.md`) |
| 8 Session runner and history | Partly | API and set progress done (CUE-14); screens not started |
| 9 End-to-end tests | Todo | Playwright harness and CI `e2e` job are in place (CUE-18); the four journeys wait for the editor and runner |
| 10 Dashboard and `/stats` | Todo | Contract written in `docs/stats-contract.md` |
| 11 Authentication | Todo | Part of Phase 3 |

Other work already on `main`: the Night hall design system and app shell (CUE-13, `docs/design-system.md`) and the seeded starter drills.

## Model routing

| Job | Model |
|---|---|
| Architecture review, schema and layout-schema decisions | Opus 5.5 |
| Difficult bugs, tricky geometry or versioning logic | Opus 5.5 (try Sonnet first) |
| Scaffold, CRUD endpoints, screens, standard features | Sonnet 5.5 |
| Unit tests, pytest and Playwright | Sonnet 5.5 |
| Boilerplate, README edits, docstrings, seed data | Haiku 5.5 or Sonnet 5.5 |
| Confusing test failure | Sonnet first, escalate to Opus |
| Running tests and pass or fail checks | CI only, no model |

## Build order

Done: prompts 0 to 5 (backend foundation), the design system, the drill library and the sessions API.

Next:

1. Prompt 8: session runner and history.
2. Prompt 9: end-to-end tests, once the editor and runner exist.
3. Prompt 11 (authentication) and Prompt 10 (dashboard), in either order, once real sessions exist.
4. Then video ingestion and vision (Phases 4 and 5), which are out of scope until the MVP is done.

Separately, record footage following section 8 of the architecture doc. This needs no code and can happen at any time; the earlier the better, because it is the data Phase 5 needs.

Follow-ups that are not prompts yet are listed at the end of this file.

---

## Prompt 0: Project context file (Sonnet 5.5) (done)

```
Create CLAUDE.md at the repo root for the billiards training platform described
in README.md and docs/architecture.md.

It must summarize and point to, not duplicate, those files. Include:
- The "Decisions: do not change" list from README.md, verbatim in short form.
- The naming conventions table and vocabulary table from README.md. State that
  naming rules have no exceptions: if unsure, follow the table, and never invent
  a second style (for example, no camelCase JSON keys).
- Workflow rules: plan before code; write tests alongside features; small
  commits using Conventional Commits; do not mark work done until tests pass;
  explain any deviation from docs/architecture.md in a short ADR under
  docs/decisions/.
- Scope rule: computer vision and AI coaching are NOT in scope yet. Do not
  scaffold them.
- Commands for running the stack, tests and migrations (add placeholders to
  fill in once they exist).

Do not write any application code in this step.
```

## Prompt 1: Architecture review (Opus 5.5) (done)

```
Read README.md and docs/architecture.md. Act as a skeptical senior engineer and
review the plan BEFORE I implement anything.

Focus on:
1. The data model (drills, drill_versions, practice_sessions, drill_runs,
   attempts): gaps, wrong cardinalities, awkward queries (for example success
   rate per drill over time, per tag, per version).
2. The layout JSON schema and validation rules: missing cases, anything painful
   to migrate when schema_version changes.
3. Whether diamond-unit coordinates will cause problems when I later map camera
   pixels to table coordinates with a homography.
4. Whether the planned videos, analysis_jobs and shot_observations tables are
   enough to link clips to individual attempts (ADR 0004 removed
   attempts.observations).
5. Versioning edge cases: editing a drill mid-session, archiving a drill with
   history, duplicating a drill.
6. Any naming that violates the conventions in README.md.

Return a prioritized list of concrete problems with proposed fixes, then a
revised schema only if you recommend changes. Do not write application code.
```

## Prompt 2: Scaffold, Phase 0 (Sonnet 5.5) (done)

```
Following CLAUDE.md and docs/architecture.md, scaffold Phase 0 only:
- Monorepo layout from README.md: apps/web (Next.js, TypeScript, Tailwind) and
  apps/api (FastAPI).
- docker-compose.yml with web, api and postgres, including a healthcheck and a
  named volume for the database.
- API: /health endpoint, settings from environment variables, Alembic
  configured, pytest configured with a separate test database.
- Web: a home page that calls /health and shows the result.
- GitHub Actions workflow: lint, type-check, pytest (Postgres service), web build.
- .env.example and run instructions added to README.md without changing its
  existing sections.

First give me a short plan listing the files you will create. Wait for my OK,
then implement. Do not add auth, drills, or anything beyond Phase 0.
```

## Prompt 3: Database models and migration (Sonnet 5.5) (done)

```
Implement the data model from docs/architecture.md section 4.5 with SQLAlchemy 2
and Alembic: users, drills, drill_versions, tags, drill_tags, practice_sessions,
drill_runs, attempts.

Requirements:
- Follow the naming conventions in README.md exactly (plural snake_case tables,
  <singular table>_id or <role>_<singular table>_id foreign keys, owner_id for
  references to users, <verb>_at timestamps, is_/has_ booleans; ADR 0005).
- drill_versions are immutable: no update path in the service layer;
  unique(drill_id, version_number).
- Do not create attempts.observations; vision data goes in shot_observations
  in Phase 4 (ADR 0004).
- Add the listed indexes. Foreign keys must never cascade-delete history.
- Seed script: one dev user. The five seed drills from section 4.9 are added
  after the layout validation service (Prompt 4), so their layouts can be
  validated.

Plan first (models, constraints, indexes), then implement with pytest tests for
the constraints and the seed script.
```

## Prompt 4: Layout validation service (Opus 5.5 to design, Sonnet 5.5 to implement) (done)

This prompt was written for layout schema v1. Since CUE-12 the stored and written layout is schema v2 (ADR 0008): no `targets` or `annotations`, and `landing_zone`, `cue_spin` and `target_pocket` instead. The rules below are the current ones; older v1 drills are upgraded when read (ADR 0002).

```
Implement the layout validation service in apps/api as pure functions, with
Pydantic v2 models for the layout JSON in docs/architecture.md section 4.3.
Use the exact key names from that section (snake_case, ids like ball_1).

Rules: balls inside cushions accounting for radius derived from table size; no
overlaps; exactly one cue ball; unique ids; the landing zone centre on the
table; the cue spin point inside the cue ball face; schema_version required.

Return structured errors (code, message, path to the offending element).

Write thorough pytest tests first, including: a ball exactly touching a cushion,
two balls exactly touching, and table sizes other than 9 ft rejected (ADR 0006).
Do not build endpoints yet.
```

Then add the five seed drills from section 4.9 to the seed script: one drill and
version 1 each, owned by the dev user, with a layout that passes the validator,
a section 4.4 scoring JSON, and idempotent reruns (matched on slug).

## Prompt 5: Drill CRUD API (Sonnet 5.5) (done)

```
Implement the drill and tag endpoints from docs/architecture.md section 4.6:
create, list (tag, difficulty, status and search filters, with pagination), get,
update (new version only if layout, instructions or scoring changed), duplicate,
archive, version history, tags.

Rules:
- Routers contain HTTP only; logic lives in a drill service; reuse the layout
  validation service.
- Scope everything to the current user through a get_current_user dependency
  (a stub returning the seeded dev user for now).
- One consistent error response shape; 404 for other users' resources.
- Pytest: happy paths, validation failures, owner scoping, versioning behaviour,
  archiving a drill that has history.

Give a plan first, then implement.
```

## Prompt 6: Table editor component (Opus 5.5 for the design note, Sonnet 5.5 to build) (done)

Done in CUE-21 on layout v2. The first attempt (PR 21, CUE-11) used layout v1, which the API rejects, so it was closed and replaced; the design note is `docs/table-editor.md`. The prompt below is kept for reference.

```
Build, or finish, the TableEditor React component in apps/web following
docs/architecture.md sections 4.3 and 4.8, on layout schema v2 (ADR 0008).

- SVG with viewBox in diamond units (0..8 by 0..4) plus rail padding.
- Props: layout (snake_case layout data), onChange, readOnly. No data fetching.
- The v2 layout holds a cue ball, object balls, an optional landing zone (a
  fixed-size circle, radius 0.5 diamonds), an optional cue spin point and an
  optional target pocket. There are no targets or annotations.
- Pure helpers in a separate kebab-case module with unit tests (Vitest is set up
  in apps/web): clamp ball to cushions, snap to grid, detect overlap, mirror
  layout horizontally and vertically, derive ball radius from table size.
- Style with the design system tokens and controls in docs/design-system.md.
- Pointer events so it works on touch and mouse.
- Build in the order listed in section 4.8 and stop after each step so I can
  review.

Start by checking what PR 21 already has, then give a short plan covering what
to keep, what to change for v2, and the state shape and undo/redo approach.
```

## Prompt 7: Drill editor and detail screens (Sonnet 5.5) (done)

The drill library (CUE-15), the editor and the detail screen (CUE-26, `docs/drill-editor.md`) are done. The prompt below is kept for reference. The web app uses a small hand-written API client in `apps/web/lib/api-client.ts` with snake_case types, which is enough at this size; extend it instead of generating one from the OpenAPI schema. Revisit generating types if the client grows past a few dozen endpoints or the types start to drift from the API.

```
Using the drill API, TableEditor and the existing app shell and design system,
build:
- Drill create and edit screen: editor, instructions, scoring rule form, tags,
  explicit Save with the base_drill_version_id check, and inline validation
  errors mapped from the API's error paths.
- Drill detail screen with a large read-only diagram, instructions and version
  history.
- Links from the library cards to these screens, and a "New drill" action.

Extend apps/web/lib/api-client.ts for the new calls. TypeScript types for API
data keep snake_case property names (no conversion layer). Mobile-friendly
layout. Add Vitest tests for the pure logic, and stable data-testid attributes.
```

## Prompt 8: Session runner and history screens (Sonnet 5.5) (partly done)

The API side is done (CUE-14): sessions, drill runs, attempts with `Idempotency-Key`, undo, and server-computed set progress. What remains is the phone UI. The offline attempt queue was deliberately cut, so the runner requires a connection.

```
Build the phone-first session runner against the sessions API in
docs/architecture.md section 4.6: start or resume the open session, choose
drills (archived drills cannot be started), large Success, Fail and Partial
buttons (or points entry for points scoring, and duration for timed scoring),
undo the last attempt, a running tally for the current drill run, simple timer,
finish session. Add session history list and detail views.

- Show the drill run's pinned version, not the drill's current one.
- Update the tally optimistically, then replace it with the set_progress the
  server returns on every attempt response.
- Send a fresh Idempotency-Key per tap and reuse it when retrying that tap.
- Run the shared cases in fixtures/scoring/set-progress-cases.json in a Vitest
  test if you compute anything locally.

Plan first, then implement.
```

## Prompt 9: End-to-end tests (Sonnet 5.5)

Do this after Prompts 6 to 8. The Playwright harness is already set up (CUE-18): config in `apps/web/playwright.config.ts`, specs in `apps/web/e2e`, run with `pnpm --filter web e2e` against the running stack, and a CI `e2e` job in `.github/workflows/ci.yml`. New specs go in that folder and run in that job; no workflow change is needed.

```
Write Playwright tests for: (1) create a drill by placing balls and saving,
(2) edit it and confirm a new version appears, (3) start a session, log 10
attempts, finish, and confirm history totals, (4) a validation error appears when
a ball overlaps another. Put them in apps/web/e2e. Use stable
data-testid attributes; do not rely on CSS classes.
```

## Prompt 10: Dashboard and /stats (Sonnet 5.5, after real data exists)

The endpoints, query parameters and response shapes are already written in `docs/stats-contract.md`; implement that contract. It has no goal or streak progress, so either extend the contract first or leave that out of this prompt. Recharts is a good fit (React-based, works with Tailwind), but the contract does not depend on it.

```
Implement the /stats endpoints exactly as in docs/stats-contract.md, with the
aggregation in SQL in a stats service and pytest tests (voided attempts
excluded, owner scoping, archived drills included, empty ranges). Then add the
dashboard screen using Recharts: success rate over time per drill (marking
version boundaries and scoring-kind changes), practice volume per week, and the
breakdown by skill tag. Handle empty states and drills with few attempts
gracefully.
```

## Prompt 11: Authentication (Sonnet 5.5, Opus 5.5 to review)

Phase 3 includes real authentication (`docs/architecture.md` section 2). Today `get_current_user` returns the seeded dev user. Because of that single seam, nothing else should have to change.

```
Replace the get_current_user stub with real authentication. Plan first, covering
the options (for example session cookies against a users table, or an identity
provider), and wait for my choice. Then implement:
- Sign up and sign in, sign out, and password hashing, if passwords are chosen.
- get_current_user returns the authenticated user; every other service and
  router stays unchanged, and owner scoping (404 for other users' resources)
  keeps its tests.
- The web app redirects to sign in when there is no session, and shows the
  signed-in user in the app shell instead of the hardcoded dev user.
- Never log or commit secrets; new settings go in .env.example with
  placeholders.

Add tests for sign in, sign out, an expired session, and one user trying to read
another user's drills, sessions and attempts.
```

## Prompt for confusing failures (Sonnet 5.5, escalate to Opus 5.5)

```
This test fails: <paste test name and output>. Before changing code, explain the
most likely cause and how you would confirm it. Check whether the failure is
caused by a violation of the locked decisions or naming conventions in
README.md. Then propose the smallest fix.
```

## Follow-ups that are not prompts yet

- ADR 0008 (layout schema v2) is still `Proposed`. It needs your decision.
- A stored layout that cannot be upgraded makes `GET /drills` return a 500 for the whole page. Consider returning a clean error or skipping that drill.
- The drill library sorts in the browser over the first 100 drills. Add a server-side sort parameter when someone has more than that.
- Session list filters (date range, location) are not in the API yet.
