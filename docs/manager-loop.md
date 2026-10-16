# Manager loop

Rules for the "manager": one Claude Code chat that works through the remaining prompts in `docs/prompts.md` without waiting for the human, except when something is critical. It plans, gets the plan approved by a simulated dev team, builds, reviews, tests, merges, and moves on. When the queue is empty it runs a security rundown and files Jira issues for what it finds.

This file is a standing instruction from the repo owner. Where it differs from `AGENTS.md`, this file wins for the manager only, and only on the points listed in [Overrides](#overrides-to-agentsmd). Everything else in `AGENTS.md`, `CLAUDE.md` and `README.md` still applies in full: locked decisions, naming, vocabulary, scope, security, and honest test reporting.

## Sources

| Need | Source |
|---|---|
| Work queue and prompt text | `docs/prompts.md` (Status table, Build order, prompt blocks) |
| How to work, commands | `AGENTS.md` (section 7 is the only command list) |
| Locked decisions, naming, vocabulary | `README.md`, mirrored in `CLAUDE.md` |
| Design, data model, API | `docs/architecture.md`, `docs/stats-contract.md` |
| UI tokens, controls, test ids | `docs/design-system.md` |
| Target look of the screens | Claude Design artifact "Cue Sense app design": https://claude.ai/artifact/LAGyGXqzaRBNyFyNmgV4eQ (read it with the Artifact tool, `action: "read"`) |
| Manager progress | `.claude/manager/state.md` (local only, never committed) |

## Work queue

Run these in order, one at a time. Skip any the Status table in `docs/prompts.md` already marks Done.

| # | Work | Notes |
|---|---|---|
| 0 | Playwright harness | Set up Playwright in `apps/web`, add one smoke spec (home page health), and add an `e2e` job to `.github/workflows/ci.yml`. Pulled forward from Prompt 9 so every UI prompt below ships its own e2e specs. Add the command to `AGENTS.md` section 7 in the same PR. |
| 1 | Prompt 6: table editor on layout v2 | Start by reading PR 21 (CUE-11). The plan decides whether to update it or replace it. If replaced, close PR 21 with a comment linking the new PR. |
| 2 | Prompt 7: drill editor and detail screens | |
| 3 | Prompt 8: session runner and history | |
| 4 | Prompt 9: end-to-end journeys | The four journeys in Prompt 9, on top of the harness from step 0. |
| 5 | Prompt 11: authentication | The prompt asks the human to choose the auth approach. That choice is a **critical stop** (see below). Plan, present the options with a recommendation, notify, and wait. |
| 6 | Prompt 10: dashboard and `/stats` | Implement `docs/stats-contract.md` as written. Leave goals and streaks out. |
| 7 | Security rundown | After every row above is merged. See [Security rundown](#security-rundown). |

Do not touch Dependabot PRs; list them in the final report. Phases 4 and 5 (video, vision, AI) stay out of scope.

## The loop, per item

Write one line to `.claude/manager/state.md` at the start and end of every step, so a new chat can resume from it.

### 1. Ticket and branch

1. Search Jira project `CUE` with JQL for an existing ticket for this work. Reuse it if found; otherwise create one (Story, or Task for infra) with a summary, description and acceptance criteria taken from the prompt. **Never write "Prompt N" in Jira text, branch names or PR titles.**
2. `git switch main && git pull`, then create `<type>/CUE-<n>-<kebab-slug>`. Jira automation moves the ticket to In Progress.

### 2. Plan: `/ecc:plan`

Run `/ecc:plan` with the prompt block from `docs/prompts.md`, the ticket's acceptance criteria, and the relevant `docs/architecture.md` sections. The plan must list files to touch, tests to add (pytest, Vitest and Playwright), data-testids for any new UI, and the docs to update. For UI work, read the Claude Design artifact first and name the screens the plan follows.

`/ecc:plan` normally waits for the user to confirm. In this loop, the dev-team verdict in step 3 is the confirmation.

### 3. Approve: `/ecc:dev-team`

Run `/ecc:dev-team` on the plan (PM, Architect, Developer, QA, plus a UX voice for UI work). Each role checks:

- PM: meets the ticket's acceptance criteria, nothing extra, phase scope respected.
- Architect: locked decisions, layering, naming, vocabulary, no deviation from `docs/architecture.md` without an ADR.
- Developer: smallest change, reuses existing code (`api-client.ts`, `components/ui/`, services).
- QA: required test cases from `AGENTS.md` section 8, Playwright specs, data-testids.
- UX: matches the Claude Design artifact and `docs/design-system.md`, phone first, 44 px targets, both themes, empty and error states.

Verdict is one of:

- **APPROVE**: go to step 4.
- **REVISE**: rerun `/ecc:plan` with the feedback. At most 2 revise rounds; a third REVISE is a critical stop.
- **ESCALATE**: anything in the critical list below. Stop and notify.

Record the verdict and the main points in `state.md`.

### 4. Build: `/ecc:orch-add-feature`

Run `/ecc:orch-add-feature` with the approved plan. Use `/ecc:orch-change-feature` instead only when the item changes existing working behaviour (for example, moving PR 21 from v1 to v2). Its commit gate is satisfied by the checks in step 5; do not wait for the human there.

Commits follow Conventional Commits. Update the Status row in `docs/prompts.md` in the same branch.

### 5. Verify locally

Run every check that applies, using the commands in `AGENTS.md` section 7, and record the exact command and result:

- API: pytest, ruff check, ruff format --check, mypy.
- Web: lint, typecheck, Vitest, build.
- Playwright: the full e2e suite.
- UI polish (UI items only): start the web app, open each new screen at phone width (375 px) and desktop, in dark and light themes. Compare against the Claude Design artifact. Check keyboard focus, labels, empty, loading and error states, and that nothing scrolls sideways on a phone. Take screenshots and attach them to the PR.

A failing check is fixed here. Never skip, delete or weaken a test to get green.

### 6. Pull request

Push and open a PR with `gh pr create`, title `<type>(<scope>): <summary> (CUE-<n>)`, and fill in `.github/pull_request_template.md` honestly: acceptance criteria met, commands run with results, screenshots, anything not run. Jira automation moves the ticket to In Review.

### 7. Review: `/code-review`

Run `/code-review` on the PR. Sort every finding with the severity table below:

- Critical: stop and notify.
- High: fix on this branch now, push, and rerun `/code-review`.
- Medium and Low: do not block. Create a Jira follow-up ticket for each (label `follow-up`, link it to this ticket) and note them in the PR.

### 8. CI and merge

1. Wait for GitHub Actions: `gh pr checks <n> --watch`. Required checks: `pr-hygiene`, `secret-scan`, `dependency-review`, the CodeQL jobs, `api (lint, type-check, pytest)`, `web (lint, type-check, build)`, and `e2e` once added.
2. If a check fails, read the log (`gh run view --log-failed`), fix, push. After 3 failed attempts on the same check, it is a critical stop.
3. If the branch is behind `main`, merge `origin/main` into it (no rebase, no force-push), rerun checks.
4. When every required check is green and no High findings are open: `gh pr merge <n> --merge --delete-branch`. Confirm the Jira ticket reached Done.

### 9. Fix after

Before starting the next queue item, work the Medium follow-up tickets from step 7 as small `fix/CUE-<n>-...` PRs through steps 4 to 8 (no new plan needed for a one-file fix). Low follow-ups stay in the backlog.

Then pick the next item.

## Severity and when to stop

Default is **do not wait**. Stop, notify the human and wait only for Critical.

| Level | Examples | Action |
|---|---|---|
| Critical | Changing a locked decision or accepting an ADR (agents never accept their own ADR); the auth approach choice in Prompt 11; editing an applied or merged migration; any destructive data operation; a committed secret; an exploitable security issue (auth bypass, injection, owner-scoping leak that returns another user's data); any `.github/workflows` change other than the Playwright `e2e` job, or any change to `CODEOWNERS`, branch protection or repo settings; work outside Phases 0 to 3; dev-team ESCALATE or a third REVISE; the same CI check failing 3 times; a merge conflict the manager cannot resolve without guessing intent | Stop. Send a push notification (PushNotification tool) and post a short summary in chat: what happened, the options, a recommendation. Record it in `state.md`. Wait for the human. |
| High | Wrong behaviour, failing or missing required tests, naming or vocabulary violations, layering violations, contrast below WCAG AA, broken keyboard access, a screen that clearly departs from the design | Fix before merge. No wait. |
| Medium | Minor UX or copy polish, missing edge-case test that is not in `AGENTS.md` section 8, small refactors, non-blocking review suggestions | Merge, file a `follow-up` ticket, fix right after (step 9). |
| Low | Nits, style preferences, ideas for later | File a ticket in the backlog, or note in the PR. |

## Integrations

- **GitHub Actions:** CI is the source of truth for "green". Use `gh` for PRs, checks and logs. Never trigger deploy or release workflows.
- **Jira (`CUE`):** use the Atlassian connector. Get the `cloudId` once with `getAccessibleAtlassianResources`. Allowed without asking: search, read, create tickets for queue items, follow-ups and security findings, comment on progress, and link issues. Not allowed: deleting issues, editing other people's issues, changing priorities of existing issues. Status changes come from automation on branch, PR and merge events; transition by hand only if automation did not fire.
- **Playwright:** every UI item adds specs for its main path under the e2e folder set up in step 0. Use `data-testid`, never CSS classes. Specs run locally in step 5 and in CI in the `e2e` job.

## Security rundown

When the queue is done:

1. Run `/ecc:security-scan` for the repo-wide scan, then the `ecc:security-reviewer` agent across `apps/api` and `apps/web` with focus on: auth and session handling, owner scoping on every endpoint, input validation, SQL built from strings, secrets in code or history, CORS and cookie settings, dependency vulnerabilities (`pnpm audit`, `pip-audit` if available), and the GitHub workflow permissions.
2. Also read GitHub's own results: `gh api repos/{owner}/{repo}/code-scanning/alerts` and `gh api repos/{owner}/{repo}/dependabot/alerts`.
3. Deduplicate findings. For each one, create a Jira Bug in `CUE` with label `security`, priority from severity (Critical to Highest, High to High, Medium to Medium, Low to Low), the file and line, how to reproduce, and a suggested fix. Link related findings to the ticket of the feature they came from.
4. Critical findings: notify the human immediately, after the tickets exist.
5. Write the summary to `.claude/manager/security-rundown.md` and post it in chat with the ticket keys.

The rundown files tickets; it does not fix them unless the human asks.

## Overrides to AGENTS.md

The repo owner set these for the manager loop. `AGENTS.md` says to follow the human and flag the conflict; these are the flagged points.

| AGENTS.md | Manager loop |
|---|---|
| Section 12: give a plan and wait for approval on anything non-trivial | The `/ecc:dev-team` verdict is the approval, except for Critical items |
| Section 5: create or comment on Jira issues only after the human approves the batch | Standing approval for the ticket types listed under Integrations |
| Section 6: no merging your own PR | The manager merges after review and green CI (step 8) |
| Section 11: workflow changes need explicit approval | Approved for one change only: adding the Playwright `e2e` job to `ci.yml` |
| `docs/prompts.md` build order | Playwright harness moves to the front (queue step 0) |

## Final report

When the security rundown is done, post one report: each queue item with its ticket, PR and merge commit; tests added; the last CI run per PR; follow-up tickets still open; security tickets by severity; anything not run or not verified; open Dependabot PRs; and every Critical stop that happened and how it was resolved.
