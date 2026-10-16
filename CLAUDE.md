@AGENTS.md

# CLAUDE.md

Project context for Claude Code. This file summarizes and points to other docs; it does not replace them. The working rules (Jira, git, testing, security, prohibitions) live in `AGENTS.md`, imported above. Do not copy them here.

| Read | For |
|---|---|
| [AGENTS.md](AGENTS.md) | How to work: Jira, git, testing, security, commands, prohibitions |
| [README.md](README.md) | Stack, layout, locked decisions, naming rules, vocabulary |
| [docs/architecture.md](docs/architecture.md) | Data model, API, drill maker design, roadmap, testing strategy |
| [docs/prompts.md](docs/prompts.md) | Build order and prompts |
| [docs/decisions/](docs/decisions/) | ADRs (see [docs/decisions/README.md](docs/decisions/README.md)) |
| [docs/design-system.md](docs/design-system.md) | Web tokens, contrast rules, shared controls, `data-testid` rules |
| [docs/setup-github-and-jira.md](docs/setup-github-and-jira.md) | GitHub Actions, branch protection and Jira setup |

A billiards training app: drill maker, practice sessions, progress dashboard. Current scope is Phases 0 to 3.

## Decisions: do not change

Changing any of these requires an ADR in `docs/decisions/` first.

1. Table coordinates use diamond units: `x` in `[0, 8]`, `y` in `[0, 4]`, origin top-left. `x = 0` is the head rail; `y = 0` is the long rail on your left facing the foot rail. Never store pixels.
2. Drill versions are immutable. Editing a drill creates a new `drill_versions` row.
3. Individual attempts are recorded. Totals and rates are derived by queries.
4. Every table except `users` has `owner_id`, including join tables, even with one user. `users` is the owner. Foreign keys between owned tables include `owner_id`.
5. Layout validation lives in one backend service, shared by API and tests.
6. Layering: routers (HTTP only) call services (business rules) call SQLAlchemy models. No business logic in routers.
7. snake_case end to end (database, API JSON, layout JSON, TypeScript API types). No camelCase conversion layer.
8. Drills with history are archived, never hard-deleted.
9. No computer vision or AI code before Phase 5. Reserved columns and tables only.

## Naming conventions

**No exceptions.** If unsure, follow the table. Never invent a second style (for example, no camelCase JSON keys).

| Context | Convention | Example |
|---|---|---|
| Database tables | plural `snake_case` | `drill_versions` |
| Database columns | `snake_case` | `created_at` |
| Foreign keys | `<singular table>_id`, or `<role>_<singular table>_id`; references to `users` are always `owner_id` | `drill_id`, `current_drill_version_id`, `owner_id` |
| Timestamps | `<verb>_at` | `created_at`, `started_at` |
| Booleans | `is_` or `has_` prefix; prefer a timestamp or enum when the state has a time or more than two values | `is_default` |
| Enum values | lowercase `snake_case` strings | `success_count` |
| JSON keys (API and layout) | `snake_case` | `object_balls` |
| JSON discriminator key | `kind` (never `type`) | `"kind": "pocket"` |
| API paths | plural lowercase nouns, hyphenated | `/drill-runs` |
| Element ids inside a layout | `<kind>_<n>` | `ball_1`, `target_1` |
| Python files, functions, variables | `snake_case` | `drill_service.py` |
| Python classes, Pydantic models | `PascalCase` | `DrillLayout` |
| TypeScript files and folders | `kebab-case` | `table-editor.tsx` |
| React components, TS types | `PascalCase` | `TableEditor` |
| TS variables and functions | `camelCase` | `snapToGrid` |
| TS properties mirroring API data | stay `snake_case` | `drill.current_drill_version_id` |
| Test files | mirror the file under test | `test_drill_service.py` |
| Git branches | `<type>/<JIRA-KEY>-<kebab-slug>` | `feat/CUE-42-drill-editor` |
| Commit messages | Conventional Commits | `feat(api): add drill duplicate endpoint` |
| PR titles | Conventional Commits plus Jira key | `feat(api): add drill duplicate endpoint (CUE-42)` |
| Doc files | `kebab-case.md` | `architecture.md` |

Tool-mandated filenames keep their form: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODEOWNERS`, `docker-compose.yml`, `.env.example`.

## Vocabulary

Use these terms exactly, in code, UI and docs.

| Term | Meaning | Avoid |
|---|---|---|
| drill | Reusable exercise | exercise, routine |
| drill version | Immutable snapshot of a drill | revision, snapshot |
| layout | Balls, targets and annotations on a table | diagram, setup |
| practice session | One visit to the table | workout |
| drill run | One drill performed inside a session | round, set |
| attempt | One shot or try within a drill run | shot (reserved for video analysis) |
| outcome | `success`, `fail`, `partial` | result |

## Workflow rules

The full workflow is in `AGENTS.md` (sections 5, 6, 8 and 12): Jira tickets, branches and PRs, tests alongside features, honest test reporting, plan before code. Project-specific additions:

- **Deviations need an ADR.** Any deviation from `docs/architecture.md` or a locked decision gets a short ADR in `docs/decisions/` (copy `docs/decisions/0000-template.md`, status `Proposed`). Agents never accept their own ADR. See [docs/decisions/README.md](docs/decisions/README.md).
- **Keep this file in sync.** The decisions, naming and vocabulary above mirror `README.md`. If `README.md` changes, update this file in the same PR.

## Scope rule

Computer vision and AI coaching are **not in scope** until Phase 5. Do not scaffold them: no OpenCV, worker code, LLM clients or job queues. `apps/worker/` stays empty.

## Commands

All commands live in `AGENTS.md` section 7. Do not duplicate them here. If a command there is still a placeholder, say it is not available instead of guessing.