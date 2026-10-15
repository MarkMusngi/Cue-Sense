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
| [0001](0001-owner-id-on-every-table-except-users.md) | `owner_id` on every table except `users` | Proposed |
| [0002](0002-json-schema-versions-upgraded-on-read.md) | Layout and scoring JSON upgraded on read | Proposed |
| [0003](0003-head-rail-at-x-zero.md) | Head rail at `x = 0` | Proposed |
| [0004](0004-drop-attempts-observations.md) | Drop `attempts.observations` | Proposed |
| [0005](0005-role-foreign-keys-and-kind-discriminator.md) | Role-prefixed foreign keys and `kind` as the discriminator key | Proposed |
| [0006](0006-nine-foot-table-only.md) | 9 ft table only | Proposed |
