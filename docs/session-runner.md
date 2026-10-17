# Session runner and history

Design note for the practice session screens in `apps/web` (Jira CUE-31). They follow the runner board of the Claude Design artifact and the sessions API in `docs/architecture.md` section 4.6. The offline attempt queue was deliberately cut: the runner needs a connection.

## Screens

| Route | What it is |
|---|---|
| `/sessions` | A "Session in progress" card with Resume (or a "Start a session" button), and the list of earlier sessions (date, location, length). |
| `/sessions/[id]` | The session: its drill runs with their totals and Resume or View, a drill picker to start another run (while the session is open) and Finish session. |
| `/sessions/[id]/runs/[runId]` | The runner, for one drill run. An ended run opens read-only. |
| `/drills/[id]` | Gets "Start drill run": joins the open session, or starts one, then opens the runner. Archived drills cannot be started. |

Not built here: stats tiles and goals (the dashboard item), notes, correcting a past attempt's outcome (the API supports it).

## The runner

Phone first: the drill's table (read-only, from the version the run **started with**, never the drill's current one), then the scoreboard, then the buttons.

- **Scoreboard:** `Set N`, a very large score, what the set needs ("3 more makes to pass", "Set passed", "Can't pass this set", "Set passed · 3 of 5"), the run total, the set's diamond sights (a make filled, a miss crossed in amber, a partial half, an attempt being saved dashed) and a live line ("Attempt 4 · Partial") beside Undo.
- **Buttons by scoring kind:** Make, Miss and Partial for `success_count` and `streak` (a streak drill shows the streak so far); points buttons from 0 to the most points for `points`; a seconds field plus the three buttons for `timed`. Make and Miss are 128 px tall, Partial 56 px, everything else at least 44 px.
- **End run** ends the drill run and returns to the session; the session screen has Finish session.

## Optimistic taps without drifting from the server

- A tap adds an attempt at once, marked "sending". While anything is unconfirmed the tally is worked out locally by `lib/set-progress.ts`; once everything is saved, the tally is the `set_progress` the server returned on the newest response.
- `lib/set-progress.ts` is a TypeScript port of the server's calculation. `lib/set-progress.test.ts` runs all 30 cases of `fixtures/scoring/set-progress-cases.json`, the same file the API's scoring tests use, so the two cannot disagree silently.
- **Idempotency:** every tap has its own `Idempotency-Key`, made by `lib/uuid.ts` from `crypto.getRandomValues`, not `crypto.randomUUID()`, which does not exist on a plain `http://` address (a phone opening the app over the local network). A failed send keeps its key; Retry sends the same one, so if the first request did reach the server it answers with that attempt (200) and nothing is duplicated. New taps wait while one has failed, so attempts reach the server in order.
- **Undo** voids the newest counted attempt once it has been saved, at once on screen, reverted with a message if it fails. It is off while an undo is in flight, so a quick double tap cannot undo two attempts.
- A 409 (`session_ended`, `drill_run_ended`) takes the refused attempt back off the screen and makes the runner read-only.
- **Reload:** the runner starts from `GET /drill-runs/{id}/attempts`, a small endpoint added for this (it returns every attempt in order, undone ones flagged), so undo and the sights survive a reload.

## How writes reach the API

As for the drill screens, the web client is server-only, so writes go through Server Actions in `app/(app)/sessions/actions.ts`. `startDrillRunAction` finds the open session (the newest session, if its `ended_at` is empty; the API closes an idle one) or starts one, then starts the run. Times for ending, finishing and undoing come from the server's clock.

## Tests

- pytest: the attempts list (order, voided flag, pagination, owner scoping, empty).
- Vitest: the set progress port against the shared cases, the runner reducer and its status, sights and totals text, `uuid`, elapsed time, the API client calls, the Server Actions, and components (the runner for each scoring kind, retry with the same key, undo, ended state, the picker and the buttons).
- Playwright (`e2e/sessions.spec.ts`, seeded stack; state is set up through the API, since Server Actions run on the Next server and a browser route cannot stub them): start a run from a drill, log attempts, undo, reload, complete a set, end the run, finish the session and find it in the history; a finished run is read-only; a second run through the picker joins the same session; an archived drill cannot start; points and timed drills; Resume; a not-found run; a phone pass.
