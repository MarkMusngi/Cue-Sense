# Architecture

Plan first, implement second. Naming rules, locked decisions and vocabulary are defined in `README.md` and apply to everything here.

## 1. Guiding decisions

1. **Drill maker and session tracking come first.** They work without any AI and are the foundation everything else attaches to.
2. **Design the data model now for vision and AI, but do not build those features.** Reserve extension points (a nullable `observations` column) so footage can link to attempts later.
3. **Use table coordinates, not pixels.**
4. **Drills are versioned.** Editing a drill never rewrites the meaning of past results.
5. **Attempts are recorded individually.**
6. **Everything is owner-scoped** with `owner_id`.

## 2. Roadmap

| Phase | Goal | Done when |
|---|---|---|
| 0 | Repo, Docker Compose, CI, `CLAUDE.md` | `docker compose up` runs empty web, api and database; CI is green |
| 1 | Drill maker (CRUD and table layout editor) | You can create, edit, tag, duplicate and archive drills |
| 2 | Practice sessions and attempt logging | You can run a session from your phone and record each attempt |
| 3 | Dashboard and real authentication | Charts of success rate, volume and trends per drill and tag |
| 4 | Video ingestion | Clips stored and linked to a session, no analysis yet |
| 5 | Computer vision worker | Ball detection and shot tracking on your real footage |
| 6 | AI coach | LLM feedback generated from structured observations |

Phases 0 to 3 are the MVP. Phase 4 needs preparation now only in how you record (section 8).

## 3. System architecture

```
[Next.js]  <--REST/JSON-->  [FastAPI]  <-->  [PostgreSQL]
                               |
                     (Phase 5+) analysis_jobs table
                               |
                     [Python worker] --> [Ollama / LLM API]
                               |
                     [video storage volume]
```

**Backend layering:** `routers` (HTTP only) call `services` (business rules), which call SQLAlchemy `models`. Pydantic `schemas` are separate from ORM models. Layout validation lives in a single `layout_service`.

**Job queue (Phase 5):** begin with a polled `analysis_jobs` table. It is enough for one machine and teaches job state handling.

## 4. Drill maker design

### 4.1 Concepts

- **Drill:** a named, reusable exercise with difficulty, tags and a current version.
- **Drill version:** immutable snapshot of layout, instructions and scoring. Saving an edit creates a new version.
- **Layout:** balls, targets and annotations on a table.
- **Scoring rule:** how attempts in a drill run are judged.

### 4.2 Coordinate system

The playing surface uses **diamond units**: `x` from 0 to 8 along the long rail, `y` from 0 to 4 along the short rail, origin at the top-left corner.

- `table.size_ft` is 7, 8 or 9. Ball radius in diamond units is derived: playing surface length in inches divided by 8 gives one diamond, ball diameter is about 2.25 in. On a 9 ft table (100 in) one diamond is 12.5 in, so the radius is about 0.09.
- Positions are floats rounded to 3 decimals. The editor snaps to a 0.05 grid by default, and snapping can be toggled.
- Pocket positions are fixed per table type in code, never stored per drill. Pocket names: `top_left`, `top_middle`, `top_right`, `bottom_left`, `bottom_middle`, `bottom_right`.

### 4.3 Layout JSON (stored as JSONB, validated by Pydantic)

```json
{
  "schema_version": 1,
  "table": { "type": "pool", "size_ft": 9 },
  "cue_ball": { "x": 2.0, "y": 2.0, "has_ball_in_hand": false },
  "object_balls": [
    { "id": "ball_1", "number": 1, "x": 5.5, "y": 1.2 }
  ],
  "targets": [
    { "id": "target_1", "kind": "pocket", "pocket": "top_right", "ball_id": "ball_1" },
    { "id": "target_2", "kind": "zone", "shape": "circle", "x": 3.0, "y": 2.0, "radius": 0.4, "label": "Cue ball finish" }
  ],
  "annotations": [
    { "id": "annotation_1", "kind": "arrow", "start": [2.0, 2.0], "end": [5.5, 1.2], "label": "Aim line" },
    { "id": "annotation_2", "kind": "text", "x": 1.0, "y": 0.5, "text": "Stun, no side spin" }
  ]
}
```

**Validation rules (server-side, always):**

- All balls fully inside the cushions (position plus radius within bounds).
- No two balls overlap (centre distance at least 2 x radius).
- Exactly one cue ball; 0 to 15 object balls; unique ids and numbers.
- Every `ball_id` in a target resolves to an existing object ball.
- Annotation count capped (for example 20).
- `schema_version` required, so layouts can be migrated later.
- Errors are structured: `code`, `message`, and `path` to the offending element, so the editor can highlight it.

### 4.4 Scoring rules

Stored as JSONB on the drill version.

| `scoring.type` | Meaning | Example |
|---|---|---|
| `success_count` | Out of N attempts, how many succeed | Make 7 of 10 |
| `streak` | Consecutive successes needed | Make 5 in a row |
| `points` | Each attempt scores 0 to a maximum | Position play, 0 to 3 |
| `timed` | Complete within a time limit | Clear 5 balls in 90 s |

Shared fields: `attempts_per_set`, `goal`, `pass_threshold`. Every attempt stores an `outcome` (`success`, `fail`, `partial`) and an optional `points` value, so all four types are computed from the same rows.

### 4.5 Database schema

```
users(id, email, password_hash, created_at)

drills(id, owner_id, title, description, difficulty 1-5,
       status [draft|active|archived], current_version_id,
       created_at, updated_at)

drill_versions(id, drill_id, version_number, instructions,
               layout JSONB, scoring JSONB, created_at)
               -- immutable; unique(drill_id, version_number)

tags(id, owner_id, name, category [skill|custom])
drill_tags(drill_id, tag_id)

practice_sessions(id, owner_id, started_at, ended_at, location, notes)

drill_runs(id, practice_session_id, drill_version_id, position,
           started_at, ended_at, notes)

attempts(id, drill_run_id, attempt_number, outcome, points,
         recorded_at, notes,
         observations JSONB NULL)   -- reserved for computer vision output

-- Created in a later migration (Phase 4+), not now:
videos, analysis_jobs, shot_observations
```

A drill run is one drill performed in a session. Attempts belong to a drill run. The drill run points at a *version*, so history stays correct after edits. Success rate, streaks and trends are derived with queries; computed totals are not stored.

Indexes: `drills(owner_id, status)`, `attempts(drill_run_id)`, `practice_sessions(owner_id, started_at)`, `drill_tags(tag_id)`.

Foreign keys never cascade-delete history. Archiving a drill sets `status = archived` and leaves its versions and attempts intact.

### 4.6 REST API (Phases 1 and 2)

```
POST   /drills                        create drill and first version
GET    /drills                        list (filters: tag, difficulty, status, search)
GET    /drills/{id}                   drill and current version
PUT    /drills/{id}                   creates a new version if layout, instructions or scoring changed
POST   /drills/{id}/duplicate         copy as a new draft
POST   /drills/{id}/archive           soft delete
GET    /drills/{id}/versions          version history
GET    /tags            POST /tags

POST   /sessions                      start a practice session
POST   /sessions/{id}/drill-runs      start a drill run (body: drill_version_id)
POST   /drill-runs/{id}/attempts      log one attempt
PATCH  /attempts/{id}                 correct an attempt (mis-tap)
POST   /sessions/{id}/finish
GET    /sessions        GET /sessions/{id}
```

Rules: pagination on every list; one consistent error shape; an `Idempotency-Key` header on `POST /drill-runs/{id}/attempts` so a flaky phone connection cannot double-log a shot; another user's resources return 404.

### 4.7 Frontend screens

1. **Drill library:** cards with table thumbnails, tags, difficulty, last practised.
2. **Drill editor:** table layout editor, instructions, scoring form, tags, live validation messages.
3. **Drill detail:** large diagram, instructions, version history, recent results.
4. **Session runner (phone-first):** choose drills, large Success, Fail and Partial buttons, undo last attempt, running tally, timer. Used standing at the table: big tap targets, one-handed.
5. **Session history:** list and detail.
6. **Dashboard (Phase 3):** success rate over time, volume per week, per-tag breakdown, streak and goal progress.

### 4.8 Table editor component

`TableEditor` renders **SVG**, takes `layout` (snake_case layout data), `onChange` and `readOnly` props, and never fetches data. The same component serves as the read-only viewer in the library, detail and session screens. The SVG `viewBox` is `0 0 8 4` plus rail padding, so all math stays in table units.

Build order:

1. Render felt, cushions, diamonds and six pockets for the chosen table size.
2. Drag the cue ball and object balls, clamped inside cushions with overlap prevention.
3. Add and remove balls; keyboard delete.
4. Pocket and zone targets.
5. Arrow, line and text annotations.
6. Snap toggle, undo and redo, reset.
7. Mirror horizontally and vertically (fast way to create drill variants).
8. Touch support using pointer events.

Pure helper functions (clamp, snap, overlap, mirror, radius from table size) live in their own module with unit tests.

### 4.9 Seed drills

Five seed drills for dogfooding and test fixtures: straight-in at three distances, 30-degree cut, stop shot, position to zone, five-ball run-out.

## 5. Testing strategy

- **Pytest:** layout validation (overlaps, bounds, bad references), scoring calculations, versioning, owner scoping, idempotent attempt logging. Highest-value suite in the project.
- **Frontend unit tests:** clamping, snapping, mirroring, overlap detection as pure functions.
- **Playwright:** a handful of end-to-end flows: create a drill, edit it (new version), run a session, see history.
- **CI (GitHub Actions):** lint, type-check, pytest with a Postgres service, frontend tests, Playwright on pull requests. Pass or fail checks need no AI.

## 6. Linking footage to attempts later

Design intent for Phase 4 and 5, not built yet:

- `videos` rows link to a `practice_session` and optionally a `drill_run`, with a start offset in seconds.
- `shot_observations` rows link to an `attempt` and hold structured measurements from the vision pipeline.
- `attempts.recorded_at` timestamps let you align video time to logged attempts.
- The AI coach only ever receives structured observations, never raw video descriptions.

## 7. Open decisions to settle before coding

1. **Game types:** 8-ball and 9-ball pool only, or also snooker or carom? Other games change dimensions, ball sizes and pockets. `table.type` already allows for it, but the editor would need extra work.
2. **Table sizes:** only your new table, or several? Start with just yours.
3. **Authentication timing:** a stubbed dev user until Phase 3, or real login earlier?
4. **Phone at the table:** if yes, make the session runner a PWA.
5. **Video storage:** which drive, and how much space (1080p at 60 fps adds up to several GB per hour).

## 8. Preparing for the table installation (data capture)

You can do all of this before or during your first session. Good capture habits save weeks later.

**Camera setup**

- Fixed position, ideally overhead or high-angle, on a tripod or mount. Do not move it between clips, or record a new calibration clip when you do.
- The whole playing surface visible, with all four corners and six pockets in frame.
- 1080p at 60 fps minimum. 30 fps blurs fast balls. 120 fps slow motion is a bonus.
- Lock exposure, focus and white balance if possible. Even, shadow-free lighting helps most.

**Calibration clip (once per setup)**

- 10 to 20 seconds of the empty table, then the same view with printed markers or checkers on the rails (or a ball on key diamonds).
- Write down table size, cloth color, ball set, and camera position.

**Shot clips**

- One drill run, or one shot, per clip. Short clips are far easier to label than a two-hour recording.
- Speak or write a slate at the start: drill name and attempt number. Keep a note of each outcome.
- Capture variety: straight shots, cuts, misses, scratches, different speeds, breaks, varied lighting. Failures are as valuable as successes.
- Include a few clips with a ruler or tape measure on the table for scale checks.

**Storage and labels**

- File names: `YYYY-MM-DD_setup-a_drill-slug_run-01.mp4`.
- Keep raw originals untouched in `data/raw/`. Never re-encode the only copy.
- Keep a `manifest.csv` with columns `file_name`, `recorded_on`, `setup_id`, `drill_slug`, `attempt_outcomes`, `notes`. Hand-typed is fine; it becomes your first labelled dataset.
