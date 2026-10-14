# Architecture Decision Records

Short records of decisions that deviate from, or add to, `docs/architecture.md`.

## When to write one

- You need to deviate from `docs/architecture.md` or a locked decision in `README.md`.
- You make a choice that is expensive to reverse (schema shape, layout schema versioning, auth approach, major dependency).

## How

1. Copy `0000-template.md` to `NNNN-short-title.md` (next free number).
2. Keep it to one page. Set status to `Proposed`.
3. Reference the ADR in the PR description and the Jira ticket.
4. A human changes the status to `Accepted` on merge. Agents never accept their own ADR, and never change a locked decision without one.

## Index

| ADR | Title | Status |
|---|---|---|
| | | |
