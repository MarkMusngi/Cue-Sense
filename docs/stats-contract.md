# Stats contract

Planned `/stats` endpoints for the Phase 3 dashboard (docs/architecture.md section 4.7, screen 6). This is a contract only: **no endpoint is implemented yet.** The dashboard ticket implements it, and changes to the shapes below need a note in that ticket.

Choosing a chart library is out of scope here.

## Rules for every stats endpoint

- **Aggregation happens in SQL**, in a `stats_service` (routers stay HTTP only, README decision 6). The browser never sums attempts.
- **Owner scoped.** Every query filters on `owner_id`; another user's drill returns 404 (`not_found`).
- **Voided attempts are excluded** (`voided_at IS NULL`). The queries can use the partial index `attempts(owner_id, recorded_at) where voided_at is null`.
- **Success rate** is the section 4.4 definition: `success` attempts divided by non-voided attempts, with `partial` counting as not a success. It is `null` when there are no attempts, never `0`.
- **Archived drills stay in stats** (section 4.5).
- **Time attribution.** An attempt belongs to the day or week of its `recorded_at`, converted to the `tz` zone. `tapped_at` is not used for bucketing.
- **Common query parameters:**

  | Param | Type | Default | Meaning |
  |---|---|---|---|
  | `from` | date (`YYYY-MM-DD`) | 90 days before `to` | First day included |
  | `to` | date (`YYYY-MM-DD`) | today in `tz` | Last day included |
  | `tz` | IANA zone name | `UTC` | Zone used to cut days and weeks |

  Weeks start on Monday. An unknown `tz`, `from` after `to`, or a range over 366 days returns 422 `validation_failed` (details use `schema_invalid`).
- Responses are not paginated: they are bounded by the date range (at most 366 days, 53 weeks) or by the owner's tag count.
- Responses use `snake_case` keys, ids are UUID strings and dates are ISO 8601, like the rest of the API.

## `GET /stats/drills/{drill_id}/success-rate`

Success rate over time for one drill, for the per-drill chart.

Extra query parameter: `bucket` = `day` or `week` (default `week`).

```json
{
  "drill_id": "6f1c…",
  "bucket": "week",
  "from": "2026-07-20",
  "to": "2026-10-16",
  "points": [
    {
      "bucket_start": "2026-10-12",
      "attempts": 42,
      "successes": 29,
      "success_rate": 0.6905,
      "drill_run_count": 4,
      "drill_version_numbers": [2, 3]
    }
  ],
  "versions": [
    {
      "drill_version_id": "a91d…",
      "version_number": 2,
      "scoring_kind": "success_count",
      "first_attempt_at": "2026-09-30T18:02:11Z",
      "scoring_kind_changed": false
    }
  ]
}
```

- `points` is ordered by `bucket_start` ascending and **omits buckets with no attempts**; the client draws gaps.
- `bucket_start` is the day, or the Monday of the week.
- `drill_version_numbers` lists the versions used in the bucket, so the chart can mark version boundaries.
- `versions` lists every version with attempts in the range, ordered by `version_number`. `scoring_kind_changed` is true when the version's `scoring.kind` differs from the previous version's, so the chart can flag that the rates are not comparable.
- Attempts are grouped by the drill run's pinned version, so editing a drill never rewrites its history.

SQL outline:

```sql
SELECT date_trunc(:bucket, a.recorded_at AT TIME ZONE :tz)::date AS bucket_start,
       count(*)                                    AS attempts,
       count(*) FILTER (WHERE a.outcome = 'success') AS successes,
       count(DISTINCT a.drill_run_id)              AS drill_run_count,
       array_agg(DISTINCT v.version_number ORDER BY v.version_number) AS drill_version_numbers
FROM attempts a
JOIN drill_runs r ON r.id = a.drill_run_id AND r.owner_id = a.owner_id
JOIN drill_versions v ON v.id = r.drill_version_id
WHERE a.owner_id = :owner_id AND r.drill_id = :drill_id AND a.voided_at IS NULL
  AND a.recorded_at >= :from_ts AND a.recorded_at < :to_ts
GROUP BY 1 ORDER BY 1;
```

`success_rate` is `successes / attempts`, computed in the same query.

## `GET /stats/weekly-volume`

Practice volume per week, across all drills.

```json
{
  "from": "2026-07-20",
  "to": "2026-10-16",
  "items": [
    { "week_start": "2026-10-12", "practice_sessions": 3, "drill_runs": 9, "attempts": 212 }
  ]
}
```

- Ordered by `week_start` ascending and **zero-filled**: every week in the range appears (`generate_series`), so the bars line up.
- `attempts` counts non-voided attempts by `recorded_at`. `drill_runs` and `practice_sessions` count by `started_at`. A session or run is counted even if it has no attempts.

## `GET /stats/tags`

Per-tag breakdown. Tags belong to drills, not versions, so this uses each drill's **current** tags across all of its history (section 4.5).

```json
{
  "from": "2026-07-20",
  "to": "2026-10-16",
  "items": [
    {
      "tag_id": "3c2e…",
      "name": "Cut shots",
      "category": "skill",
      "drill_count": 3,
      "drill_run_count": 11,
      "attempts": 160,
      "successes": 97,
      "success_rate": 0.6063
    }
  ]
}
```

- Ordered by `attempts` descending, then `name`. Tags with no attempts in the range are omitted.
- An attempt on a drill with several tags counts once under each of its tags, so tag rows do not sum to the overall total.
- Drills without tags are not listed.
- `drill_count` is the number of distinct drills with attempts in the range.

## Not in this contract

Streak and goal progress (section 4.7), per-session summaries, and anything that needs set pass or fail history. Add them to this file when the dashboard ticket needs them.
