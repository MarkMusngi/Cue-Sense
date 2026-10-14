# Architecture review

- **Date:** 2026-10-15
- **Scope:** `README.md` and `docs/architecture.md`, reviewed before any implementation
- **Status:** Triaged. Accepted findings are applied to `docs/architecture.md`. ADRs 0001 to 0005 are `Proposed`.

**Citations.** "README decision N" means item N in the README's "Decisions: do not change" list. "Architecture §1.N" means guiding decision N in section 1 of `docs/architecture.md`. The two lists are numbered independently.

## Summary

The overall design holds up: drill runs point at a fixed drill version, attempts are individual rows, and positions use diamond units. There were three serious problems. The schema did not enforce the owner scoping and drill-to-version links it relied on. Idempotency and undo had nowhere to be stored. The video-to-attempt link relied on timestamps that would not line up.

## Triage

| # | Finding | Priority | Triage | ADR | README | CLAUDE.md |
|---|---|---|---|---|---|---|
| 1 | `owner_id` on every table except `users`; owner-composite foreign keys | P0 | Accept | 0001 | Decision 4 wording | Mirror |
| 2 | `current_drill_version_id`: nullable, composite, deferrable | P0 | Accept | | | |
| 3 | Store the idempotency key | P0 | Accept | | | |
| 4 | Undo voids an attempt (`voided_at`) | P0 | Accept | | | |
| 5 | Scoring JSON: per-kind fields, `schema_version`, `duration_ms`, success rate | P0 | Accept | 0002 | Safe-to-change list | |
| 6 | JSON documents upgraded on read, never rewritten | P0 | Accept | 0002 | Safe-to-change list | |
| 7 | `drill_id` on `drill_runs`; missing indexes | P1 | Accept | | | |
| 8 | Tag history is retroactive (documented as intended) | P1 | Accept | | | |
| 9 | Layout schema gaps | P1 | Accept | | | |
| 10 | Optimistic concurrency on drill edits | P1 | Accept | | | |
| 11 | Explicit Save, no autosaved versions | P1 | Accept | | | |
| 12 | Session edge cases and auto-close trigger | P1 | Accept | | | |
| 13 | Homography and diamond units | P2 | Accept now: x=0 is the head rail. Defer to Phase 4: calibration, `camera_setups` | 0003 | Decision 1 wording | Mirror |
| 14 | Linking clips to attempts | P2 | Accept now: `tapped_at`, `drills.slug`, drop `attempts.observations`. Defer to Phase 4: `videos`, `analysis_jobs`, `shot_observations` | 0004 | | |
| 15 | Archive and duplicate rules | P2 | Accept | | | |
| 16 | API paths: `/practice-sessions`, no verb paths | P3 | Accept | | | |
| 17 | `drill_runs.position` renamed `run_number` | P3 | Accept | | | |
| 18 | Foreign key rule allows role prefixes | P3 | Accept | 0005 | Naming table | Mirror |
| 19 | Boolean examples describe columns that won't exist | P3 | Accept | | Naming table examples | Mirror |
| 20 | `kind` as the only JSON discriminator key | P3 | Accept | 0005 | Naming table and safe-to-change list | Mirror |

`AGENTS.md` repeats some of this wording (§3, §4, §9). It is updated alongside items 1, 13, 14 and 18.

## Which items need an ADR

An item needs an ADR if it does any of the following:
- changes the wording or meaning of a README decision
- changes a naming rule (not just an example)
- drops something `docs/architecture.md` committed to
- falls under "expensive to reverse" in `docs/decisions/README.md` (this explicitly includes layout schema versioning)

Items that only make the architecture doc conform to existing rules need no ADR.

The four items you asked about, checked against the README's actual text:

- **Item 1:** needs an ADR. README decision 4 says "Every row is owner-scoped with `owner_id`". Taken literally, that includes `users`. Join tables get `owner_id`; `users` does not, because it is the owner. That changes locked wording, so it gets ADR 0001 and a README and CLAUDE.md update.
- **Item 16:** no ADR and no README change. The README rule is "plural lowercase nouns, hyphen if multi-word". `/sessions` and the verb paths broke that rule; the new paths follow it. Only `docs/architecture.md` changes.
- **Item 19:** README and CLAUDE.md update, no ADR. The rule (`is_` or `has_` prefix) stays the same. Only the examples change, because `is_archived` and `has_ball_in_hand` describe columns the design no longer has.
- **Item 20:** needs an ADR. It adds a naming rule (`kind` is the only discriminator key). It also changes the README's safe-to-change wording, which names `scoring.type`. It goes in ADR 0005 with item 18.

Other items that need an ADR:
- **Items 5 and 6:** ADR 0002, because this is layout schema versioning. The README safe-to-change list says "bump `schema_version` and add a migration", which becomes "add an upgrade function".
- **Item 13:** ADR 0003, because the head-rail convention adds a physical anchor to README decision 1.
- **Item 14:** ADR 0004, because dropping `attempts.observations` reverses architecture §1.2.
- **Item 18:** ADR 0005, because it changes the foreign key rule in the README naming table.

No other accepted item changes README wording. Items 2 to 4 and 7 to 12 refine schema and API details inside the architecture doc and follow the README.

## Decision-number check

All three citations pointed at the right rule, but item 14 used a different numbering list from the others, which made it ambiguous. Citations below now use "README decision N" or "architecture §1.N".

- **Item 6** ("decision 2"): this is README decision 2, "Drill versions are immutable". Correct.
- **Item 14** ("guiding decision 2"): this is architecture §1.2, which reserves a nullable `observations` column. Correct, but README decision 2 is unrelated, hence the ambiguity.
- **Item 15** ("decision 8"): this is README decision 8, "Drills are archived, never hard-deleted once they have history". Correct. The hard-delete rule in item 15 stays inside it, because only drafts with no history can be deleted.

## Findings

### P0: fix before the first migration

**1. Owner scoping is not enforced, which breaks README decision 4.**
`drill_versions`, `drill_tags`, `drill_runs` and `attempts` had no `owner_id`, and nothing stopped one owner's drill run from pointing at another owner's drill version.
*Fix:* every table except `users` has `owner_id`, including join tables such as `drill_tags`. `users` does not, because it is the owner. Use foreign keys that include `owner_id`, for example `drill_runs(owner_id, practice_session_id) → practice_sessions(owner_id, id)`, backed by `unique(owner_id, id)` on parent tables.

**2. `drills.current_version_id` is a circular foreign key and is not tied to its own drill.**
*Fix:* rename it `current_drill_version_id` (see item 18) and make it nullable. Use the two-column foreign key `(id, current_drill_version_id) → drill_versions(drill_id, id)`, `DEFERRABLE INITIALLY DEFERRED`. Insert the drill and version 1 in one transaction.

**3. The `Idempotency-Key` header has no storage.**
*Fix:* `attempts.idempotency_key` (a UUID) with `unique(owner_id, idempotency_key)`. A replayed request returns the original row.

**4. "Undo last attempt" is undefined.**
*Fix:* add `attempts.voided_at`. Undo sets it, and stats exclude voided attempts. `attempt_number` stays as tap order. Set membership comes from `row_number()` over non-voided attempts.

**5. The scoring JSON is underspecified and unversioned.**
*Fix:*
- Add `scoring.schema_version`.
- Use explicit fields for each kind, and drop the ambiguous `goal`.
- Add a nullable `attempts.duration_ms` for `timed` drills.
- Success rate = success / non-voided attempts, with `partial` counting as not a success.
- For `points` drills the server derives the outcome: 0 is fail, the maximum is success, anything else is partial.

**6. Layout migration conflicts with immutable versions (README decision 2).**
*Fix:* stored layout and scoring JSON is never rewritten or re-validated against newer rules. Pure upgrade functions (v1 to v2 and so on) in `layout_service` and the scoring service run on read, so the API always returns the latest `schema_version`. Writes accept only the latest version. Keep one test fixture per historical version.

### P1: fix before Phase 1 and 2 code

**7. Per-drill queries need a join across three tables.**
*Fix:* also store `drill_id` on `drill_runs`, kept consistent by the foreign key `(drill_id, drill_version_id) → drill_versions(drill_id, id)`. Add these indexes, since Postgres does not index foreign keys automatically: `drill_runs(drill_id, started_at)`, `drill_runs(drill_version_id)` and `drill_runs(practice_session_id)`. Per-drill charts use the outcome-based rate across versions, mark version boundaries, and flag changes of scoring kind.

**8. Per-tag history is retroactive.** Tags belong to drills, so retagging a drill regroups past results.
*Fix:* document this as intended.

**9. Layout schema gaps.**
*Fix:*
- **Cue ball:** give it `"id": "ball_0"`, and give zones an optional `ball_id`.
- **Ball in hand:** replace `has_ball_in_hand` with `ball_in_hand: none | anywhere | behind_head_string`.
- **Coordinates:** use `{x, y}` objects everywhere.
- **Annotations:** add a `line` kind, and give arrows and lines a `points` list.
- **Zones:** add a `rect` shape.
- **Frozen balls:** validate bounds and overlap after rounding, with a tolerance of 0.002, so frozen balls pass.
- **Object ball numbers:** make `number` nullable and unique only when present.
- **Element ids:** keep them stable across versions.
- **Table kind:** limit it to `pool` for the MVP, which resolves architecture §7.1.

**10. Concurrent edits collide.**
*Fix:* the client sends `base_drill_version_id`, and the server returns 409 if that is not the current version. Change detection compares canonical JSON (sorted keys, rounded numbers).

**11. Version spam.**
*Fix:* the editor uses an explicit Save button. Autosave only writes local draft state. Strict immutability under README decision 2 stays.

**12. Session edge cases.**
*Fix:*
- **One open session:** at most one open session per owner, enforced by a partial unique index where `ended_at is null`.
- **Closing:** finishing a session ends its open drill runs.
- **Starting a run:** the client sends `drill_id`, and the server pins the current version. Archived drills are refused.
- **Auto-close trigger:** an open session closes automatically when either
  - a new session is started, or
  - the API next touches the open session and it has had no activity for 6 hours (`SESSION_IDLE_HOURS`, default 6).

  Its `ended_at` becomes the last activity: the latest non-voided attempt's `recorded_at`, or `started_at` if it has none. Its open drill runs close the same way. The check runs on request, so no background job is needed, consistent with README decision 9.

### P2: design now, build cheap parts now

**13. Homography and diamond units.** Diamond units are fine; on a 2:1 table they form a scaled flat plane.
*Accept now:*
- x=0 is the head rail, so the head string is at x=2 and the foot spot at (6, 2).
- y=0 is the long rail on your left when standing at the head rail facing the foot rail.
- The diagram draws the head rail on the left, so "top-left" keeps its meaning.

*Defer to Phase 4:*
- calibrating from markers on the cloth, because the origin is where the cushion noses would meet and is not visible
- fitting the homography to the ball-centre plane (1.125 in above the cloth) to remove parallax
- removing lens distortion first
- storing measured playing-surface dimensions in `camera_setups`

**14. Linking clips to attempts.**
*Accept now:*
- `attempts.tapped_at` (client time) alongside `recorded_at` (server time).
- `drills.slug`, unique per owner, so `manifest.csv` and clip names can be joined to drills.
- Drop `attempts.observations`, which reverses architecture §1.2. Adding a nullable column later is a harmless migration.

*Defer to Phase 4:*
- `videos`, with a wall-clock start and a correctable `clock_offset_ms`
- `analysis_jobs`, with `pipeline_version`
- `shot_observations`, which belong to a video and an analysis job, cover a time range, and have a nullable `attempt_id` and `link_method`

**15. Archive and duplicate rules.**
*Fix:*
- **History:** a drill has history once any drill run references any of its versions.
- **Archived drills:** they keep their history, stay in stats, can't start new drill runs, can be duplicated, and can be unarchived.
- **Drafts:** a draft without history may be hard-deleted, which stays inside README decision 8.
- **Duplicating:** this copies the source's current version as version 1 of a new draft drill. It also copies tags and records `source_drill_version_id`.
- **Tag deletion:** this removes its `drill_tags` rows. Link rows are not history.

### P3: naming

**16. API paths.**
*Fix:*
- Rename `/sessions` to `/practice-sessions`.
- Archiving becomes `PATCH /drills/{id}` with `status`.
- Finishing becomes `PATCH /practice-sessions/{id}` with `ended_at`.
- Duplicating becomes `POST /drills` with `source_drill_id`.

**17. `drill_runs.position`** clashes with "position", a core billiards term (cue ball position play).
*Fix:* rename it `run_number`.

**18. The foreign key rule contradicts README decision 4.**
*Fix:* the rule becomes `<singular table>_id`, with an optional role prefix `<role>_<singular table>_id` (for example `current_drill_version_id`). References to `users` are always `owner_id`.

**19. Boolean examples** (`is_archived`, `has_ball_in_hand`) describe columns that won't exist.
*Fix:* replace them. Prefer a timestamp or an enum when the state has a time or more than two values.

**20. `type` vs `kind`.**
*Fix:* `kind` is the only discriminator key in JSON (`table.kind`, `scoring.kind`, targets, annotations).
