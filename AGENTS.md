# AGENTS.md

Instructions for coding agents (Claude Code and others) working in this repository. Read this file fully before changing anything. If it conflicts with a direct instruction from the human you are working for, follow the human and flag the conflict.

> **Maintainers:** fill in the `<placeholders>` in section 7 after the Phase 0 scaffold exists.

---

## 1. Project

A billiards training platform: a drill library with a table-layout editor, practice sessions with attempt logging, and a progress dashboard. Current scope is Phases 0 to 3.

- **Web:** `apps/web` (Next.js, TypeScript, Tailwind)
- **API:** `apps/api` (FastAPI, SQLAlchemy 2, Alembic, Postgres)
- **Infra:** `docker-compose.yml`, GitHub Actions
- **Tests:** pytest (API), frontend unit tests, Playwright (end-to-end)

## 2. Where truth lives

| Need | Source |
|---|---|
| Locked decisions, naming conventions, vocabulary | `README.md` (mirrored in `CLAUDE.md`) |
| Design, data model, layout schema, endpoints, roadmap | `docs/architecture.md` |
| Build order and prompts | `docs/prompts.md` |
| Deviations and new decisions | `docs/decisions/` (ADRs) |
| GitHub Actions, branch protection, Jira setup | `docs/setup-github-and-jira.md` |
| What to build next | The Jira ticket you were assigned |
| How to work | This file |

If these disagree, `README.md` locked decisions win, then `docs/architecture.md`, then this file. Report the conflict; do not silently pick one.

**Read the relevant sections of `README.md` and `docs/architecture.md` before implementing any feature.** Read nearby code and tests too, and match their patterns.

## 3. Naming, vocabulary and locked decisions

Naming rules have **no exceptions**. If unsure, follow the tables in `README.md`. Never invent a second style.

Examples (the README is authoritative):

- JSON keys are `snake_case`. No camelCase keys, and no conversion layer in the web app. TypeScript properties that mirror API data stay `snake_case`.
- Tables are plural `snake_case`; foreign keys are `<table>_id` or `<role>_<table>_id`, and references to `users` are `owner_id`; JSON discriminators are `kind`; timestamps are `<verb>_at`; booleans are `is_` / `has_`.
- TypeScript files and folders are `kebab-case`; doc files are `kebab-case.md`.
- Tool-mandated filenames keep their form: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODEOWNERS`, `docker-compose.yml`, `.env.example`.
- Use the vocabulary table exactly: say "drill run" not "round", "attempt" not "shot" (reserved for video analysis).

Do not change anything in the README's "Decisions: do not change" list. If you think one is wrong, write an ADR proposal (status `Proposed`) and stop.

## 4. Scope

- **Phases 0 to 3 are in scope.** Computer vision and AI coaching are **not in scope until Phase 5**.
- Do not scaffold them, stub them, or add dependencies for them: no OpenCV, worker code, LLM clients, or job queues. `apps/worker/` stays empty. Preparation is limited to the Phase 4+ table design in `docs/architecture.md` section 6, which is not created before Phase 4 (ADR 0004).
- Build only what the assigned ticket asks for. No auth, no extra features, no speculative abstractions.
- Respect phase order from the Jira backlog and the build order in `docs/prompts.md`.

## 5. Jira workflow

- Work on **one ticket at a time**. Read its description and acceptance criteria first.
- If the ticket is ambiguous or contradicts the docs, ask or comment. **Do not invent requirements.**
- Include the issue key in the branch name and PR title (see section 6) so Jira links the work automatically.
- Agents may **read** Jira issues freely. They may **create or comment on** issues only when the human asks for that specific batch, after showing the plan and getting approval. They never edit existing issues, delete issues, or change priorities without explicit approval. Work only in project `CUE`. Status transitions are handled by Jira automation on branch, PR, and merge events.
- When done, report which acceptance criteria are met, with evidence, and which are not.

## 6. Git workflow

- **Never commit directly to `main`.** Work on a feature branch.
- Branch name: `<type>/<CUE-123>-<kebab-slug>`, for example `feat/CUE-42-layout-validation`. Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`.
- Commits follow Conventional Commits: `feat(api): add layout validation service`.
- PR title: `<type>(<scope>): <summary> (CUE-123)`. CI (`pr-hygiene`) enforces this.
- Small, focused commits. No unrelated refactors or dependency bumps in the same PR.
- No force-pushes, no history rewrites on shared branches, no merging your own PR.
- Fill in the PR template honestly.

## 7. Commands

This is the **single source of commands**; `CLAUDE.md` points here. Run from the repo root. If a command is marked not available, say so rather than guessing.

```bash
# First-time setup
cp .env.example .env                    # local only; never commit .env

corepack enable pnpm                    # only needed for web checks outside Docker

# Start the stack (web :3000, api :8000, postgres :5432)
docker compose up -d --build

# API (inside the api container; pytest only ever uses TEST_DATABASE_URL)
docker compose exec api pytest
docker compose exec api ruff check .
docker compose exec api ruff format --check .
docker compose exec api mypy app tests
docker compose exec api alembic revision --autogenerate -m "..."
docker compose exec api alembic upgrade head
docker compose exec api python -m app.scripts.seed   # dev user; safe to rerun

# Web (from the repo root)
pnpm install
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test                  # Vitest: pure lib tests and component tests (jsdom)

# End-to-end
# Playwright: not available yet (added with Prompt 7)
```

## 8. Testing

- New functionality ships with tests. Bug fixes ship with a regression test that fails before the fix.
- Never delete, skip, or weaken a test to get green. If a test is truly outdated, update it and explain why.
- Write tests alongside the feature, not afterward.
- Project-specific cases that must stay covered:
  - Layout validation: a ball exactly touching a cushion, two balls exactly touching, table sizes other than 9 ft rejected.
  - Versioning: editing creates a new `drill_versions` row only when layout, instructions, or scoring changed.
  - Owner scoping: other users' resources return 404.
  - Idempotency: repeated `Idempotency-Key` on attempt creation does not duplicate.
- Playwright tests use stable `data-testid` attributes, never CSS classes.

### Be honest about results

- **Never claim a test, lint, type-check, or build passed unless you ran it in this session and saw it pass.**
- Report the exact command and outcome. If you could not run something, say "not run" and why.
- If something fails, report it. Do not call a failure "unrelated" without evidence.
- "Done" means the acceptance criteria are met and the tests were run, not that the code was written.

## 9. Architecture invariants

Summarized from the project docs. If this list and the docs differ, the docs win.

- Table coordinates are diamond units (`x` in `[0, 8]`, `y` in `[0, 4]`, origin top-left, `x = 0` at the head rail). Never store pixels.
- `drill_versions` are **immutable**: no update path in the service layer; unique `(drill_id, version_number)`.
- Individual attempts are recorded; totals and rates are derived by queries.
- Foreign keys **never cascade-delete history**. Drills with history are **archived, never hard-deleted**.
- Every table except `users` has `owner_id`, including join tables (README decision 4). Every resource is scoped to the current user via `get_current_user`.
- Layering: routers (HTTP only) call services (business rules) call SQLAlchemy models. Layout validation is one pure-function service shared by API and tests.
- One consistent error response shape.
- Dashboard aggregation happens in SQL behind `/stats` endpoints, not in the browser.
- Explain any deviation from `docs/architecture.md` in a short ADR under `docs/decisions/`. Agents never accept their own ADR.

## 10. Security and data

- **Never commit** credentials, API keys, tokens, private keys, `.env` files, or production data.
- Add new settings to `.env.example` with placeholder values only. Use synthetic data in tests and seeds.
- Never paste secrets into code, comments, commits, PRs, or chat.
- If you find a committed secret, stop and tell the human. Do not try to scrub history yourself.
- Prefer well-maintained dependencies; mention every new one in your report.

## 11. Hard prohibitions

Without explicit approval for that specific action, do **not**:

- Deploy, release, or trigger production pipelines.
- Run destructive operations: dropping or truncating tables, `rm -rf` outside build artifacts, `git reset --hard` or `git clean -fd` on work you did not create, deleting volumes or cloud resources.
- Edit a migration that has already been applied or merged. Add a new migration instead.
- Run migrations or scripts against any database other than the local or test one.
- Modify `.github/workflows/`, `CODEOWNERS`, branch protection, or repository settings. **Exception:** a prompt or ticket that explicitly asks for a workflow change (for example, the CI workflow in the Phase 0 scaffold prompt, or adding Playwright to CI) authorizes only that change to only that file.
- Disable linters, type checks, security scanners, or tests to get past a failure.
- Make bulk or irreversible changes (mass renames, data backfills).

When in doubt, stop and ask. Prefer a plan, dry run, or diff.

## 12. How to work

1. Read the ticket, then the relevant docs and code.
2. Give a short plan (files to touch, tests to add) and wait for approval on anything non-trivial.
3. Create a branch with the Jira key.
4. Implement the smallest change that meets the acceptance criteria.
5. Add tests, then run lint, type check, tests, and build as applicable.
6. Open a PR using the template.

## 13. Final report

Include: what changed and why; branch and PR; tests added; commands run with actual results; anything not run or not verified; acceptance criteria met or unmet; docs or ADRs updated; risks and open questions.