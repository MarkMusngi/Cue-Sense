# Architecture

Plan first, implement second. Naming rules, locked decisions and vocabulary are defined in `README.md` and apply to everything here. Review findings and their triage are in `docs/architecture-review.md`.

## 1. Guiding decisions

1. **Drill maker and session tracking come first.** They work without any AI and are the foundation everything else attaches to.
2. **Design the data model now for vision and AI, but do not build those features.** The Phase 4+ tables are designed in section 6 and created in a later migration. No placeholder columns are reserved; adding a nullable column later is a harmless migration (ADR 0004).
3. **Use table coordinates, not pixels.**
4. **Drills are versioned.** Editing a drill never rewrites the meaning of past results.
5. **Attempts are recorded individually.**
6. **Everything is owner-scoped.** Every table except `users` has `owner_id`, including join tables; `users` is the owner (ADR 0001).

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

- **Orientation (ADR 0003):** `x = 0` is the head rail, so the head string is at `x = 2` and the foot spot at `(6, 2)`. `y = 0` is the long rail on your left when standing at the head rail facing the foot rail. Diagrams draw the head rail on the left, so the origin is at the top-left.
- The origin is where the cushion noses would meet. It is not a visible point (the pockets cut the corners, and the diamonds sit back on the rail top).
- `table.size_ft` is 7, 8 or 9. Ball radius in diamond units is derived: the playing surface length in inches divided by 8 gives one diamond, and a pool ball's diameter is 2.25 in. On a 9 ft table (100 in), one diamond is 12.5 in, so the radius is 0.09.
- Positions are floats rounded to 3 decimals. The editor snaps to a 0.05 grid by default, and snapping can be toggled.
- Pocket positions are fixed per table kind in code, never stored per drill. Pocket names: `top_left`, `top_middle`, `top_right`, `bottom_left`, `bottom_middle`, `bottom_right`.

### 4.3 Layout JSON (stored as JSONB, validated by Pydantic)

```json
{
  "schema_version": 1,
  "table": { "kind": "pool", "size_ft": 9 },
  "cue_ball": { "id": "ball_0", "x": 2.0, "y": 2.0, "ball_in_hand": "none" },
  "object_balls": [
    { "id": "ball_1", "number": 1, "x": 5.5, "y": 1.2 }
  ],
  "targets": [
    { "id": "target_1", "kind": "pocket", "pocket": "top_right", "ball_id": "ball_1" },
    { "id": "target_2", "kind": "zone", "shape": "circle", "ball_id": "ball_0",
      "x": 3.0, "y": 2.0, "radius": 0.4, "label": "Cue ball finish" },
    { "id": "target_3", "kind": "zone", "shape": "rect", "ball_id": "ball_0",
      "x": 6.0, "y": 0.0, "width": 2.0, "height": 1.0, "label": "Foot-rail box" }
  ],
  "annotations": [
    { "id": "annotation_1", "kind": "arrow",
      "points": [{ "x": 2.0, "y": 2.0 }, { "x": 5.5, "y": 1.2 }], "label": "Aim line" },
    { "id": "annotation_2", "kind": "line",
      "points": [{ "x": 5.5, "y": 1.2 }, { "x": 8.0, "y": 0.0 }] },
    { "id": "annotation_3", "kind": "text", "x": 1.0, "y": 0.5, "text": "Stun, no side spin" }
  ]
}
```

- `table.kind` is `pool` only for the MVP (open decision 7.1).
- `cue_ball.ball_in_hand` is `none`, `anywhere` or `behind_head_string`. When it is not `none`, `x` and `y` are a suggested position. For `behind_head_string`, that position must satisfy `x <= 2`.
- Object ball `number` is optional (generic "any ball" drills) and unique when present.
- Zones have shape `circle` (`x`, `y`, `radius`) or `rect` (`x`, `y` top-left corner, `width`, `height`). The optional `ball_id` names the ball that must finish in the zone.
- Arrows and lines take a `points` list with at least 2 points (for bank and kick paths). Every position is an `{x, y}` object.
- Element ids follow `<kind>_<n>`; the cue ball is always `ball_0`. Ids are never renumbered on save, so they stay stable across versions.

**Validation rules (server-side, always, after rounding to 3 decimals):**

- All balls fully inside the cushions: position plus radius within bounds, with a tolerance of 0.002 so balls frozen to the rail pass.
- No two balls overlap: centre distance at least 2 x radius minus the same tolerance, so frozen balls pass.
- Exactly one cue ball; 0 to 15 object balls; unique ids; unique numbers where present.
- Every `ball_id` in a target resolves to the cue ball or an existing object ball. Pocket targets reference object balls only.
- Annotation count capped (for example 20).
- `schema_version` required and equal to the latest version on write.
- Errors are structured: `code`, `message`, and `path` to the offending element, so the editor can highlight it.

**Schema versions (ADR 0002).** Layout and scoring JSON both carry `schema_version`. Stored documents are never rewritten and never re-validated against newer rules. Pure upgrade functions (v1 to v2 and so on) live in `layout_service` and the scoring service and run on read, so the API always returns the latest version. Writes accept only the latest version. Each historical version keeps a test fixture.

### 4.4 Scoring rules

Stored as JSONB on the drill version, discriminated by `kind`.

| `scoring.kind` | Fields | Example |
|---|---|---|
| `success_count` | `attempts_per_set`, `pass_threshold` | Make 7 of 10 |
| `streak` | `streak_length` | Make 5 in a row |
| `points` | `attempts_per_set`, `max_points_per_attempt`, `pass_threshold` (total per set) | Position play, 0 to 3 per attempt |
| `timed` | `attempts_per_set`, `time_limit_seconds`, `pass_threshold` | Clear 5 balls in 90 s |

```json
{ "schema_version": 1, "kind": "success_count", "attempts_per_set": 10, "pass_threshold": 7 }
```

- Every attempt stores an `outcome` (`success`, `fail`, `partial`), an optional `points` value and an optional `duration_ms`, so all four kinds are computed from the same rows.
- For `points`, the client sends `points` and the server derives the outcome: 0 is `fail`, the maximum is `success`, anything else is `partial`.
- For `timed`, one attempt is one timed try, and `duration_ms` is required.
- **Success rate** is `success` attempts divided by non-voided attempts; `partial` counts as not a success. It is defined once in the scoring service and used everywhere.
- **Sets:** attempt N of a drill run (counting non-voided attempts in `attempt_number` order) belongs to set `ceil(N / attempts_per_set)`.

### 4.5 Database schema

Every table except `users` has `owner_id`, and foreign keys between owned tables include `owner_id` so a row can never reference another owner's data (ADR 0001).

```
users(id, email, password_hash, created_at)

drills(id, owner_id, title, slug, description, difficulty 1-5,
       status [draft|active|archived], current_drill_version_id NULL,
       source_drill_version_id NULL, created_at, updated_at)
       -- unique(owner_id, id), unique(owner_id, slug)
       -- (id, current_drill_version_id) -> drill_versions(drill_id, id),
       --   DEFERRABLE INITIALLY DEFERRED

drill_versions(id, owner_id, drill_id, version_number, instructions,
               layout JSONB, scoring JSONB, created_at)
               -- immutable; unique(drill_id, version_number), unique(drill_id, id)
               -- (owner_id, drill_id) -> drills(owner_id, id)

tags(id, owner_id, name, category [skill|custom], created_at)
               -- unique(owner_id, id), unique(owner_id, name)
drill_tags(owner_id, drill_id, tag_id)
               -- primary key (drill_id, tag_id)
               -- (owner_id, drill_id) -> drills, (owner_id, tag_id) -> tags

practice_sessions(id, owner_id, started_at, ended_at NULL, location, notes)
               -- unique(owner_id, id)
               -- unique(owner_id) where ended_at is null   (one open session)

drill_runs(id, owner_id, practice_session_id, drill_id, drill_version_id,
           run_number, started_at, ended_at NULL, notes)
           -- unique(owner_id, id), unique(practice_session_id, run_number)
           -- (owner_id, practice_session_id) -> practice_sessions(owner_id, id)
           -- (drill_id, drill_version_id) -> drill_versions(drill_id, id)

attempts(id, owner_id, drill_run_id, attempt_number,
         outcome [success|fail|partial], points NULL, duration_ms NULL,
         idempotency_key, tapped_at, recorded_at, voided_at NULL, notes)
         -- unique(drill_run_id, attempt_number), unique(owner_id, idempotency_key)
         -- (owner_id, drill_run_id) -> drill_runs(owner_id, id)
```

- A drill run is one drill performed in a session, and attempts belong to a drill run.
- A drill run pins a drill *version*, so history stays correct after edits.
- `drill_runs.drill_id` is stored alongside the version for cheap per-drill queries. It cannot drift, because a version's drill never changes and the composite foreign key enforces the pair.
- Success rate, streaks and trends are derived with queries; computed totals are not stored.
- `attempts.tapped_at` is the client's time of the tap, and `recorded_at` is the server's receipt time. Both are kept for aligning video later.
- Timestamps are `timestamptz`.

**Indexes:**
- `drills(owner_id, status)`
- `drill_runs(drill_id, started_at)`
- `drill_runs(drill_version_id)`
- `drill_runs(practice_session_id)`
- `practice_sessions(owner_id, started_at)`
- `attempts(drill_run_id)`
- `drill_tags(tag_id)`

**Delete behaviour:**
- Foreign keys never cascade-delete history.
- `drill_tags` rows are links, not history: deleting a tag or a draft drill removes its links.

**Lifecycle rules:**

- **History:** a drill has history once any drill run references any of its versions.
- **Editing:** the editor saves explicitly. Autosave only writes local draft state.
  - A save creates a new version only if layout, instructions or scoring differ from the current version, compared as canonical JSON (sorted keys, rounded numbers).
  - The client sends `base_drill_version_id`; if it is not the current version, the server returns 409.
  - Title, description, difficulty and tags are drill fields and are not versioned.
- **Editing mid-session:** drill runs already started keep their pinned version. A new drill run pins whatever version is current when it starts. The session runner always renders the run's pinned version.
- **Archive:**
  - Archiving keeps all history, and archived drills stay in stats.
  - An archived drill cannot start new drill runs (409).
  - It can still be duplicated, and unarchived by setting `status` back to `active`.
  - Drill runs already in progress may finish.
- **Hard delete:** only a draft without history may be hard-deleted, together with its versions. A delete request for anything else returns 409.
- **Duplicate:**
  - Duplicating creates a new draft drill whose version 1 copies the source's current layout, instructions and scoring.
  - It copies the tags, sets `source_drill_version_id`, and appends " (copy)" to the title with a unique slug.
  - Mirrored variants are created the same way.
- **Tags:** tags belong to drills, not versions, so per-tag stats reflect a drill's current tags across all its history. This is intended.
- **Sessions:**
  - An owner has at most one open session. Starting a new one closes the open one.
  - Whenever the API loads an owner's open session, it closes the session if it has had no activity for `SESSION_IDLE_HOURS` (default 6). Activity is the latest non-voided attempt's `recorded_at`, or `started_at` if there are no attempts.
  - A closed session's `ended_at` is set to that last activity, and its open drill runs close the same way.
  - These checks run on request; there is no background job.
- **Attempts:**
  - Undo sets `voided_at`; stats and set numbering ignore voided attempts.
  - Corrections edit `outcome`, `points` or `duration_ms` in place.
  - Attempts in an ended session cannot be added (409).

### 4.6 REST API (Phases 1 and 2)

```
POST   /drills                              create a drill and version 1
                                            (body may include source_drill_id to duplicate)
GET    /drills                              list (filters: tag, difficulty, status, search)
GET    /drills/{id}                         drill and current version
PUT    /drills/{id}                         save edits; new version if layout, instructions
                                            or scoring changed (body: base_drill_version_id)
PATCH  /drills/{id}                         status changes: activate, archive, unarchive
DELETE /drills/{id}                         drafts without history only, otherwise 409
GET    /drills/{id}/versions                version history
GET    /tags            POST /tags

POST   /practice-sessions                   start a practice session (closes any open one)
GET    /practice-sessions                   list
GET    /practice-sessions/{id}              detail
PATCH  /practice-sessions/{id}              finish (ended_at), location, notes
POST   /practice-sessions/{id}/drill-runs   start a drill run (body: drill_id; server pins
                                            the current version)
PATCH  /drill-runs/{id}                     end a drill run (ended_at), notes
POST   /drill-runs/{id}/attempts            log one attempt (Idempotency-Key header required)
PATCH  /attempts/{id}                       correct an attempt, or undo it (voided_at)
```

Rules:
- Pagination on every list.
- One consistent error shape.
- Another user's resources return 404.
- 409 for a stale `base_drill_version_id`, an archived drill, or an ended session.
- The `Idempotency-Key` header is a client-generated UUID stored as `attempts.idempotency_key`. A replay returns the original attempt, so a flaky phone connection cannot double-log an attempt.

### 4.7 Frontend screens

1. **Drill library:** cards with table thumbnails, tags, difficulty, last practised.
2. **Drill editor:** table layout editor, instructions, scoring form, tags, live validation messages, explicit Save.
3. **Drill detail:** large diagram, instructions, version history, recent results.
4. **Session runner (phone-first):** choose drills, large Success, Fail and Partial buttons, undo last attempt (voids it), running tally, timer. Used standing at the table: big tap targets, one-handed. It renders the drill run's pinned version.
5. **Session history:** list and detail.
6. **Dashboard (Phase 3):** success rate over time, volume per week, per-tag breakdown, streak and goal progress. Per-drill charts mark version boundaries and flag scoring kind changes.

### 4.8 Table editor component

`TableEditor` renders **SVG**. It takes `layout` (snake_case layout data), `onChange` and `readOnly` props, and never fetches data. The same component serves as the read-only viewer in the library, detail and session screens. The SVG `viewBox` is `0 0 8 4` plus rail padding, so all math stays in table units. The head rail is drawn on the left (section 4.2).

Build order:

1. Render felt, cushions, diamonds and six pockets for the chosen table size.
2. Drag the cue ball and object balls, clamped inside cushions with overlap prevention (frozen balls allowed within the validation tolerance).
3. Add and remove balls; keyboard delete.
4. Pocket targets, and circle and rect zone targets.
5. Arrow, line and text annotations.
6. Snap toggle, undo and redo, reset.
7. Mirror horizontally and vertically (fast way to create drill variants via duplicate).
8. Touch support using pointer events.

Pure helper functions (clamp, snap, overlap, mirror, radius from table size) live in their own module with unit tests.

### 4.9 Seed drills

Five seed drills for dogfooding and test fixtures: straight-in at three distances, 30-degree cut, stop shot, position to zone, five-ball run-out.

## 5. Testing strategy

- **Pytest:** the highest-value suite in the project. It covers:
  - layout validation: overlaps, bounds, frozen balls at the tolerance, bad references, 7 ft vs 9 ft
  - one upgrade fixture per historical schema version
  - scoring calculations, success rate and set numbering with voided attempts
  - versioning and stale-base 409s
  - owner scoping, including composite foreign keys rejecting cross-owner references
  - idempotent attempt logging
  - session auto-close
- **Frontend unit tests:** clamping, snapping, mirroring, overlap detection as pure functions.
- **Playwright:** a handful of end-to-end flows: create a drill, edit it (new version), run a session, see history.
- **CI (GitHub Actions):** lint, type-check, pytest with a Postgres service, frontend tests, Playwright on pull requests. Pass or fail checks need no AI.

## 6. Linking footage to attempts later

Design intent for Phases 4 and 5. Nothing here is created before Phase 4 (README decision 9).

```
camera_setups(id, owner_id, name, table_size_ft, surface_length_in, surface_width_in,
              calibration JSONB, created_at)
videos(id, owner_id, practice_session_id, camera_setup_id, file_path,
       started_at, clock_offset_ms, duration_ms, fps, created_at)
analysis_jobs(id, owner_id, video_id, pipeline_version,
              status [queued|running|succeeded|failed], error NULL,
              created_at, started_at NULL, ended_at NULL)
shot_observations(id, owner_id, video_id, analysis_job_id, start_ms, end_ms,
                  attempt_id NULL, link_method [auto|manual] NULL, data JSONB, created_at)
```

- **Time alignment:** `attempts.recorded_at` comes seconds after the shot, and the camera clock differs and drifts. Alignment uses `attempts.tapped_at` and the video's wall-clock `started_at` plus a correctable `clock_offset_ms`, synced by filming the phone screen or a clap at the start of each clip.
- **Linking shots to attempts:** the vision pipeline finds shots before it knows which attempt they belong to. A shot observation belongs to a video and an analysis job, covers a time range, and links to an attempt only once matched, either automatically or by hand. One attempt can have observations from several cameras or several pipeline versions.
- **Calibration:**
  - Remove lens distortion first.
  - Fit the homography to the ball-centre plane (1.125 in above the cloth) to avoid parallax from a high-angle camera.
  - Use markers placed on the cloth, because the coordinate origin is not a visible point.
  - Measured playing-surface dimensions live in `camera_setups`, not in drills.
- **AI coach:** the AI coach only ever receives structured observations, never raw video descriptions.

## 7. Open decisions to settle before coding

1. **Game types:** resolved. Pool only for the MVP (`table.kind = pool`). Snooker or carom would change dimensions, ball sizes and pockets.
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

- 10 to 20 seconds of the empty table, then the same view with printed markers or checkers on the cloth (or a ball on key spots).
- Mark which end is the head rail (`x = 0`), for example with a card on the head rail.
- Write down table size, measured playing surface length and width, cloth color, ball set, and camera position.

**Shot clips**

- One drill run, or one shot, per clip. Short clips are far easier to label than a two-hour recording.
- Speak or write a slate at the start: drill name and attempt number. Keep a note of each outcome.
- Show the phone's clock to the camera, or clap, at the start of a clip so video time can be aligned with attempt taps.
- Capture variety: straight shots, cuts, misses, scratches, different speeds, breaks, varied lighting. Failures are as valuable as successes.
- Include a few clips with a ruler or tape measure on the table for scale checks.

**Storage and labels**

- File names: `YYYY-MM-DD_setup-a_drill-slug_run-01.mp4`, where `drill-slug` is `drills.slug` and `run-01` is `drill_runs.run_number`.
- Keep raw originals untouched in `data/raw/`. Never re-encode the only copy.
- Keep a `manifest.csv` with columns `file_name`, `recorded_on`, `setup_id`, `drill_slug`, `attempt_outcomes`, `notes`. Hand-typed is fine; it becomes your first labelled dataset.
