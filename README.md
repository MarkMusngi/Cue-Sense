# Billiards Training Platform

A personal billiards training app: build custom drills on a table diagram, run practice sessions at the table, and track progress over time. Computer vision and an AI coach come later, built on the data this app collects.

**Current scope:** Phases 0 to 3 (drill maker, sessions, dashboard). Computer vision and AI are out of scope until Phase 5.

| Document | Purpose |
|---|---|
| `README.md` | Stack, what to change and not change, naming rules (this file) |
| `docs/architecture.md` | Data model, API, drill maker design, roadmap, data capture plan |
| `docs/prompts.md` | Model routing and ready-to-paste prompts for Claude Code |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Recharts |
| Backend API | Python, FastAPI, Pydantic v2 |
| Database | PostgreSQL, SQLAlchemy 2.x, Alembic |
| Testing | Pytest, Playwright, frontend unit tests |
| CI | GitHub Actions |
| Local operation | Docker Compose |
| Later (Phase 5+) | OpenCV, Python worker, Ollama or an external LLM API |

## Repository layout

```
billiards/
  apps/
    web/              # Next.js frontend
    api/              # FastAPI backend
    worker/           # empty until Phase 5
  docs/
    architecture.md
    prompts.md
    decisions/        # short ADRs, one file per decision
  CLAUDE.md           # project context for Claude Code
  README.md
  docker-compose.yml
  .env.example
```

## Decisions: do not change

Changing any of these requires writing a short ADR in `docs/decisions/` first, because the rest of the system depends on them.

1. **Table coordinates use diamond units.** `x` in `[0, 8]`, `y` in `[0, 4]`, origin at the top-left of the playing surface. Never store pixels.
2. **Drill versions are immutable.** Editing a drill creates a new `drill_versions` row. Past results always point at the version they were recorded against.
3. **Individual attempts are recorded**, not just totals. Totals and rates are always derived by queries.
4. **Every row is owner-scoped** with `owner_id`, even while there is only one user.
5. **Layout validation lives in one backend service**, shared by the API and tests.
6. **Layering:** routers (HTTP only) call services (business rules), which call SQLAlchemy models. Routers never contain business logic.
7. **Data is snake_case end to end** (database, API JSON, layout JSON, TypeScript API types). There is no camelCase conversion layer.
8. **Drills are archived, never hard-deleted** once they have history.
9. **No computer vision or AI code** is added before Phase 5. Reserved columns and tables are the only preparation.

## Decisions: safe to change

- Visual design, colors, layout, component library choices.
- Charting details (Recharts is a default, not a requirement).
- Seed drills and tag names.
- Additional scoring types (add to the `scoring.type` enum and the scoring service, with tests).
- Additional annotation or target kinds in the layout schema (bump `schema_version` and add a migration).
- Job queue technology in Phase 5 (start with a polled `analysis_jobs` table; Redis/RQ or Celery only if needed).
- Hosting. The default is local Docker Compose.
- Authentication method in Phase 3 (the plan uses a stubbed dev user until then).

## Naming conventions (one rule per context, no exceptions)

| Context | Convention | Example |
|---|---|---|
| Database tables | plural `snake_case` | `drill_versions` |
| Database columns | `snake_case` | `created_at` |
| Foreign keys | singular table name + `_id` | `drill_id`, `drill_run_id` |
| Timestamps | `<verb>_at` | `created_at`, `started_at`, `ended_at` |
| Booleans | `is_` or `has_` prefix | `is_archived`, `has_ball_in_hand` |
| Enum values | lowercase `snake_case` strings | `success_count`, `top_left` |
| JSON keys (API and layout) | `snake_case` | `object_balls`, `schema_version` |
| API paths | plural lowercase nouns, hyphen if multi-word | `/drills`, `/drill-runs` |
| Element ids inside a layout | `<kind>_<n>` | `ball_1`, `target_1`, `annotation_1` |
| Python files, functions, variables | `snake_case` | `drill_service.py` |
| Python classes, Pydantic models | `PascalCase` | `DrillLayout` |
| TypeScript files and folders | `kebab-case` | `table-editor.tsx` |
| React components, TS types | `PascalCase` | `TableEditor`, `DrillVersion` |
| TS variables and functions | `camelCase` | `snapToGrid` |
| TS properties that mirror API data | stay `snake_case` | `drill.current_version_id` |
| Test files | mirror the file under test | `test_drill_service.py`, `table-editor.test.tsx` |
| Git branches | `kebab-case` with type prefix | `feat/drill-editor` |
| Commit messages | Conventional Commits | `feat(api): add drill duplicate endpoint` |
| Doc files | `kebab-case.md` | `architecture.md` |

Tool-mandated filenames keep their required form: `README.md`, `CLAUDE.md`, `docker-compose.yml`, `.env.example`.

### Vocabulary (use these terms exactly, in code, UI and docs)

| Term | Meaning | Avoid |
|---|---|---|
| drill | A reusable exercise | exercise, routine |
| drill version | Immutable snapshot of a drill | revision, snapshot |
| layout | Balls, targets and annotations on a table | diagram, setup |
| practice session | One visit to the table | workout |
| drill run | One drill performed inside a session | round, set |
| attempt | One shot or one try within a drill run | shot (reserved for video analysis later) |
| outcome | `success`, `fail`, `partial` | result |

## Getting started

```
cp .env.example .env
docker compose up
```

Then follow `docs/architecture.md` for the roadmap and `docs/prompts.md` for the build order.

### Running locally

You need Docker Desktop (it includes Compose and runs Postgres for you). Node 20+ and pnpm (`corepack enable pnpm`) are only needed to run web checks outside Docker.

1. `cp .env.example .env` and replace the placeholder password in both `POSTGRES_PASSWORD` and the two database URLs.
2. `docker compose up --build`. The first run builds the images and creates the `cuesense` and `cuesense_test` databases.
3. Open http://localhost:3000. The home page shows the API health. The API itself is at http://localhost:8000/health (interactive docs at http://localhost:8000/docs).

Test, lint and migration commands are listed in `AGENTS.md` section 7.
