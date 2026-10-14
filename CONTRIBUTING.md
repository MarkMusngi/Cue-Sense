# Contributing

This guide is for humans. Coding agents should also read [`AGENTS.md`](AGENTS.md).

## Before you start

1. Read `README.md` (locked decisions, naming conventions, vocabulary) and the relevant sections of `docs/architecture.md`.
2. Pick a Jira ticket and read its acceptance criteria. If it is unclear, ask in the ticket rather than guessing.

## Workflow

1. Branch from an up-to-date `main`: `git switch -c feat/CUE-123-short-slug`
2. Make small commits using [Conventional Commits](https://www.conventionalcommits.org/): `feat(api): add layout validation service`
3. Write tests alongside the change. Bug fixes need a regression test.
4. Run lint, type-check, tests, and build locally (commands are in `AGENTS.md` section 7).
5. Open a PR titled `type(scope): summary (CUE-123)` and fill in the template honestly.
6. Wait for CI and a review. Do not merge with failing checks.

## Rules that matter most

- No direct commits to `main`.
- Naming rules have no exceptions (see `README.md`).
- Never commit secrets, `.env` files, or production data. Add new settings to `.env.example`.
- Never edit a migration that has already been merged; add a new one.
- Record any deviation from `docs/architecture.md` as an ADR in `docs/decisions/`.
- Computer vision and AI coaching are out of scope for now.

## Setup of GitHub Actions and Jira

See [`docs/setup-github-and-jira.md`](docs/SETUP-GITHUB-AND-JIRA.md).
