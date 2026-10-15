# 0006: 9 ft table only

- **Status:** Proposed
- **Date:** 2026-10-15
- **Jira:** CUE-8
- **Deviates from:** `docs/architecture.md` §4.2 (`table.size_ft` is 7, 8 or 9) and §5 ("7 ft vs 9 ft" validation tests); `AGENTS.md` §8 (the same test case)

## Context

Architecture §4.2 lets `table.size_ft` be 7, 8 or 9 and derives ball radius from the size. §5 and `AGENTS.md` §8 require layout validation tests comparing 7 ft and 9 ft tables. Open decision §7.2 asked whether to support only the owner's table or several, and recommended starting with just one.

The owner plays only on a 9 ft table. The doc gives a surface length only for 9 ft (100 in); 7 and 8 ft lengths vary by manufacturer and would be guesses. Supporting sizes nobody uses means extra tests and editor options to keep correct with no user.

## Decision

Pool tables are 9 ft only for now. This settles open decision §7.2.

- The layout JSON keeps the `table.size_ft` key, but the only accepted value is `9`. Any other value is a `schema_invalid` error.
- Ball radius is still derived from a per-size surface-length lookup (one entry: 9 ft = 100 in), never hardcoded as `0.09` in validation rules. The web editor reads the size the same way.
- The "7 ft vs 9 ft" test is replaced by: other sizes (7, 8, 10) are rejected, and every bounds and overlap rule uses the derived radius.

## Alternatives considered

- **Keep 7, 8 and 9 ft:** cheap in code, but the 7 and 8 ft surface lengths would be unverified guesses and the extra tests exercise tables nobody plays on.
- **Drop the `size_ft` key entirely:** simpler JSON, but adding a size later would need a `schema_version` bump and an upgrade function (ADR 0002). Keeping the key with one allowed value makes adding a size later a widening change.

## Consequences

- Adding a size later means adding a lookup entry and tests, and widening the allowed values. No migration and no `schema_version` bump, because every stored layout is valid 9 ft data.
- The web editor needs no table-size picker.
- Doc updates in the same PR as this ADR:
  - `docs/architecture.md` §4.2: `table.size_ft` is 9 only for now (ADR 0006).
  - `docs/architecture.md` §5: replace "7 ft vs 9 ft" with "non-9 ft sizes rejected".
  - `docs/architecture.md` §7.2: mark resolved (9 ft only).
  - `AGENTS.md` §8: replace "7 ft vs 9 ft tables" with "table sizes other than 9 ft rejected".
  - `docs/prompts.md` Prompt 4: replace the 7 ft vs 9 ft test.
  - `README.md` and `CLAUDE.md`: no change (neither mentions table size).
