# Prompts

Use these in Claude Code, one at a time. Review the diff and commit after each. Every prompt asks for a plan before code so you stay in control. Naming rules and locked decisions are in `README.md`; the design is in `docs/architecture.md`.

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

1. Save `README.md` and `docs/` into the repo, then run Prompt 1 for the review.
2. Apply the review's findings to `docs/architecture.md`.
3. Prompts 0, 2, 3, 4, 5: backend foundation with tests.
4. Prompts 6 and 7: table editor and drill screens.
5. Prompts 8 and 9: sessions and end-to-end tests.
6. Record first footage next week following section 8 of the architecture doc, while the above is being built.
7. Prompt 10 (dashboard) once real data exists. Then data ingestion and vision.

---

## Prompt 0: Project context file (Sonnet 5.5)

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

## Prompt 1: Architecture review (Opus 5.5)

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
4. Whether attempts.observations and the planned videos, analysis_jobs and
   shot_observations tables are enough to link clips to individual attempts.
5. Versioning edge cases: editing a drill mid-session, archiving a drill with
   history, duplicating a drill.
6. Any naming that violates the conventions in README.md.

Return a prioritized list of concrete problems with proposed fixes, then a
revised schema only if you recommend changes. Do not write application code.
```

## Prompt 2: Scaffold, Phase 0 (Sonnet 5.5)

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

## Prompt 3: Database models and migration (Sonnet 5.5)

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
- Seed script: one dev user and the five seed drills from section 4.9, each with
  a valid layout.

Plan first (models, constraints, indexes), then implement with pytest tests for
the constraints and the seed script.
```

## Prompt 4: Layout validation service (Opus 5.5 to design, Sonnet 5.5 to implement)

```
Implement the layout validation service in apps/api as pure functions, with
Pydantic v2 models for the layout JSON in docs/architecture.md section 4.3.
Use the exact key names from that section (snake_case, ids like ball_1).

Rules: balls inside cushions accounting for radius derived from table size; no
overlaps; exactly one cue ball; unique ids; target references resolve;
annotation count cap; schema_version required.

Return structured errors (code, message, path to the offending element).

Write thorough pytest tests first, including: a ball exactly touching a cushion,
two balls exactly touching, and 7 ft vs 9 ft tables. Do not build endpoints yet.
```

## Prompt 5: Drill CRUD API (Sonnet 5.5)

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

## Prompt 6: Table editor component (Opus 5.5 for the design note, Sonnet 5.5 to build)

```
Build the TableEditor React component in apps/web following
docs/architecture.md section 4.8.

- SVG with viewBox in diamond units (0..8 by 0..4) plus rail padding.
- Props: layout (snake_case layout data), onChange, readOnly. No data fetching.
- Pure helpers in a separate kebab-case module with unit tests: clamp ball to
  cushions, snap to grid, detect overlap, mirror layout horizontally and
  vertically, derive ball radius from table size.
- Pointer events so it works on touch and mouse.
- Build in the order listed in section 4.8 and stop after each step so I can
  review.

Start with a short design note covering state shape and undo/redo approach.
```

## Prompt 7: Drill library and editor screens (Sonnet 5.5)

```
Using the drill API and TableEditor, build:
- Drill library: cards with read-only table thumbnails, filters by tag and
  difficulty, search.
- Drill create and edit screen: editor, instructions, scoring rule form, tags,
  and inline validation errors mapped from the API's error paths.
- Drill detail screen with version history.

Use a typed API client derived from the OpenAPI schema. TypeScript types for API
data keep snake_case property names (no conversion layer). Mobile-friendly
layout.
```

## Prompt 8: Sessions and session runner (Sonnet 5.5)

```
Implement Phase 2: session, drill-run and attempt endpoints from
docs/architecture.md section 4.6, with Idempotency-Key support on
POST /drill-runs/{id}/attempts and a correction path via PATCH /attempts/{id}.
Then build the phone-first session runner: choose drills, large Success, Fail
and Partial buttons, undo last attempt, running tally for the current drill run,
simple timer, finish session. Add session history list and detail views.

Pytest for scoring calculations (success_count, streak, points, timed) and for
idempotency. Plan first, then implement.
```

## Prompt 9: End-to-end tests (Sonnet 5.5)

```
Write Playwright tests for: (1) create a drill by placing balls and saving,
(2) edit it and confirm a new version appears, (3) start a session, log 10
attempts, finish, and confirm history totals, (4) a validation error appears when
a ball overlaps another. Add them to the GitHub Actions workflow. Use stable
data-testid attributes; do not rely on CSS classes.
```

## Prompt 10: Dashboard (Sonnet 5.5, after real data exists)

```
Add a dashboard using Recharts: success rate over time per drill, practice volume
per week, breakdown by skill tag, and goal and streak progress. Implement the
aggregation as SQL queries behind /stats endpoints with tests, not in the
browser. Handle empty states and drills with few attempts gracefully.
```

## Prompt for confusing failures (Sonnet 5.5, escalate to Opus 5.5)

```
This test fails: <paste test name and output>. Before changing code, explain the
most likely cause and how you would confirm it. Check whether the failure is
caused by a violation of the locked decisions or naming conventions in
README.md. Then propose the smallest fix.
```
