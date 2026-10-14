## Jira ticket

<!-- e.g. PROJ-123. The key must also be in the branch name or PR title. -->

## What changed and why

<!-- A few sentences. Link the relevant section of docs/architecture.md if applicable. -->

## Acceptance criteria

<!-- Copy the criteria from the Jira ticket and mark each one. -->

- [ ] Criterion 1
- [ ] Criterion 2

## Tests

**Added or updated:**

-

**Commands actually run, with results** (do not tick anything you did not run):

| Command | Result |
|---|---|
| | |

- [ ] API tests (pytest)
- [ ] Web lint and type-check
- [ ] Web build
- [ ] Playwright (if UI or flows changed)
- [ ] Not run, and why:

## Checklist

- [ ] Branch is not `main`; PR title follows `type(scope): summary (PROJ-123)`
- [ ] Naming follows `README.md` (snake_case JSON, table and column rules, no exceptions)
- [ ] No credentials, `.env` files, or production data committed
- [ ] New settings added to `.env.example` (placeholders only)
- [ ] Migrations: new migration added, no already-applied migration edited
- [ ] Docs updated, or ADR added in `docs/decisions/` for any deviation from `docs/architecture.md`
- [ ] No CV or AI-coaching scaffolding (out of scope)

## Risks, follow-ups, open questions

