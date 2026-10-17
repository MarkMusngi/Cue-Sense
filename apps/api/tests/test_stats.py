from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models import Drill, DrillRun, PracticeSession, User
from tests.conftest import make_client
from tests.factories import (
    make_attempt,
    make_drill,
    make_drill_tag,
    make_run,
    make_session,
    make_tag,
    make_user,
    make_version,
)

TIMED = {
    "schema_version": 1,
    "kind": "timed",
    "attempts_per_set": 5,
    "time_limit_seconds": 120,
    "pass_threshold": 3,
}


def at(day: str, hour: int = 12) -> datetime:
    """A UTC instant on a day like "2026-10-14"."""
    return datetime.fromisoformat(day).replace(hour=hour, tzinfo=UTC)


def log(
    db: Session,
    owner: User,
    run: DrillRun,
    outcomes: list[str],
    day: str,
    start: int = 1,
    **fields: Any,
) -> None:
    for offset, outcome in enumerate(outcomes):
        make_attempt(db, owner, run, start + offset, outcome=outcome, recorded_at=at(day), **fields)


def new_run(
    db: Session,
    owner: User,
    drill: Drill,
    day: str,
    session: PracticeSession | None = None,
    **f: Any,
) -> DrillRun:
    practice_session = session or make_session(db, owner, started_at=at(day), ended_at=at(day, 13))
    return make_run(db, owner, practice_session, drill, started_at=at(day), **f)


RANGE = {"from": "2026-10-01", "to": "2026-10-31"}


# Success rate over time


def test_success_rate_buckets_by_week_and_leaves_gaps(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    # 2026-10-12 is a Monday; 10-14 and 10-16 are in its week, 10-27 in the week of 10-26.
    run = new_run(db_session, owner, drill, "2026-10-14")
    log(db_session, owner, run, ["success", "fail", "success"], "2026-10-14")
    log(db_session, owner, run, ["partial"], "2026-10-16", start=4)
    run2 = new_run(db_session, owner, drill, "2026-10-27")
    log(db_session, owner, run2, ["success", "success"], "2026-10-27")

    response = make_client(db_session, owner).get(
        f"/stats/drills/{drill.id}/success-rate", params=RANGE
    )

    assert response.status_code == 200
    body = response.json()
    assert body["bucket"] == "week"
    assert body["from"] == "2026-10-01"
    assert body["to"] == "2026-10-31"
    assert body["points"] == [
        {
            "bucket_start": "2026-10-12",
            "attempts": 4,
            "successes": 2,
            "success_rate": 0.5,
            "drill_run_count": 1,
            "drill_version_numbers": [1],
        },
        {
            "bucket_start": "2026-10-26",
            "attempts": 2,
            "successes": 2,
            "success_rate": 1.0,
            "drill_run_count": 1,
            "drill_version_numbers": [1],
        },
    ]


def test_success_rate_by_day(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = new_run(db_session, owner, drill, "2026-10-14")
    log(db_session, owner, run, ["success", "fail", "fail"], "2026-10-14")
    log(db_session, owner, run, ["success"], "2026-10-15", start=4)

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params={**RANGE, "bucket": "day"})
        .json()
    )

    assert [(p["bucket_start"], p["attempts"], p["success_rate"]) for p in body["points"]] == [
        ("2026-10-14", 3, 0.3333),
        ("2026-10-15", 1, 1.0),
    ]


def test_success_rate_excludes_voided_attempts(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = new_run(db_session, owner, drill, "2026-10-14")
    log(db_session, owner, run, ["success", "fail"], "2026-10-14")
    make_attempt(
        db_session,
        owner,
        run,
        3,
        outcome="success",
        recorded_at=at("2026-10-14"),
        voided_at=at("2026-10-14", 13),
    )

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params=RANGE)
        .json()
    )

    assert body["points"][0]["attempts"] == 2
    assert body["points"][0]["successes"] == 1


def test_a_range_with_no_attempts_is_empty_not_zero(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params=RANGE)
        .json()
    )

    assert body["points"] == []
    assert body["versions"] == []


def test_archived_drills_stay_in_the_stats(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner, status="archived")
    run = new_run(db_session, owner, drill, "2026-10-14")
    log(db_session, owner, run, ["success"], "2026-10-14")

    response = make_client(db_session, owner).get(
        f"/stats/drills/{drill.id}/success-rate", params=RANGE
    )

    assert response.status_code == 200
    assert response.json()["points"][0]["attempts"] == 1


def test_attempts_outside_the_range_are_left_out(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = new_run(db_session, owner, drill, "2026-09-30")
    log(db_session, owner, run, ["success"], "2026-09-30")
    log(db_session, owner, run, ["success"], "2026-10-01", start=2)
    log(db_session, owner, run, ["success"], "2026-10-31", start=3)
    log(db_session, owner, run, ["success"], "2026-11-01", start=4)

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params={**RANGE, "bucket": "day"})
        .json()
    )

    assert [p["bucket_start"] for p in body["points"]] == ["2026-10-01", "2026-10-31"]


def test_days_are_cut_in_the_requested_zone(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = new_run(db_session, owner, drill, "2026-10-14")
    # 20:00 UTC on the 14th is already the 15th in Auckland (UTC+13).
    log(
        db_session,
        owner,
        run,
        ["success"],
        "2026-10-14",
    )
    make_attempt(db_session, owner, run, 2, outcome="fail", recorded_at=at("2026-10-14", 20))

    body = (
        make_client(db_session, owner)
        .get(
            f"/stats/drills/{drill.id}/success-rate",
            params={**RANGE, "bucket": "day", "tz": "Pacific/Auckland"},
        )
        .json()
    )

    # 12:00 UTC is 01:00 on the 15th in Auckland as well, so both land on the 15th.
    assert [(p["bucket_start"], p["attempts"]) for p in body["points"]] == [("2026-10-15", 2)]


def test_versions_are_listed_with_scoring_kind_changes(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    v1 = drill.current_drill_version_id
    v2 = make_version(db_session, drill, 2)  # same scoring kind as version 1
    v3 = make_version(db_session, drill, 3, scoring=TIMED)
    drill.current_drill_version_id = v3.id
    db_session.flush()
    session = make_session(
        db_session, owner, started_at=at("2026-10-14"), ended_at=at("2026-10-14", 13)
    )
    run1 = make_run(db_session, owner, session, drill, 1, drill_version_id=v1)
    run2 = make_run(db_session, owner, session, drill, 2, drill_version_id=v2.id)
    run3 = make_run(db_session, owner, session, drill, 3, drill_version_id=v3.id)
    log(db_session, owner, run1, ["success"], "2026-10-14")
    log(db_session, owner, run2, ["fail"], "2026-10-14")
    log(db_session, owner, run3, ["success", "success"], "2026-10-15")

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params=RANGE)
        .json()
    )

    assert [
        (v["version_number"], v["scoring_kind"], v["scoring_kind_changed"])
        for v in body["versions"]
    ] == [(1, "success_count", False), (2, "success_count", False), (3, "timed", True)]
    assert body["points"][0]["drill_version_numbers"] == [1, 2, 3]
    assert body["versions"][0]["drill_version_id"] == str(v1)
    assert body["versions"][2]["first_attempt_at"].startswith("2026-10-15")


def test_another_owners_drill_is_404(db_session: Session) -> None:
    owner = make_user(db_session)
    other = make_user(db_session)
    drill = make_drill(db_session, other)

    response = make_client(db_session, owner).get(
        f"/stats/drills/{drill.id}/success-rate", params=RANGE
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_success_rate_ignores_another_owners_attempts(db_session: Session) -> None:
    owner = make_user(db_session)
    other = make_user(db_session)
    drill = make_drill(db_session, owner)
    other_drill = make_drill(db_session, other)
    log(
        db_session,
        other,
        new_run(db_session, other, other_drill, "2026-10-14"),
        ["success"],
        "2026-10-14",
    )

    body = (
        make_client(db_session, owner)
        .get(f"/stats/drills/{drill.id}/success-rate", params=RANGE)
        .json()
    )

    assert body["points"] == []


# Range validation


def test_invalid_ranges_are_422(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    client = make_client(db_session, owner)
    url = f"/stats/drills/{drill.id}/success-rate"

    bad_zone = client.get(url, params={"tz": "Not/AZone"})
    backwards = client.get(url, params={"from": "2026-10-10", "to": "2026-10-01"})
    too_long = client.get(url, params={"from": "2025-01-01", "to": "2026-10-01"})
    not_a_date = client.get(url, params={"from": "yesterday"})
    bad_bucket = client.get(url, params={"bucket": "month"})

    for response in (bad_zone, backwards, too_long, not_a_date, bad_bucket):
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_failed"
    assert bad_zone.json()["error"]["details"][0]["path"] == ["query", "tz"]
    assert backwards.json()["error"]["details"][0]["path"] == ["query", "from"]


def test_a_range_of_366_days_is_allowed(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get(
        "/stats/weekly-volume", params={"from": "2025-10-01", "to": "2026-10-01"}
    )

    assert response.status_code == 200


def test_defaults_are_the_last_90_days(db_session: Session) -> None:
    owner = make_user(db_session)

    body = make_client(db_session, owner).get("/stats/weekly-volume").json()

    to = date.fromisoformat(body["to"])
    assert to == datetime.now(UTC).date() or to == datetime.now(UTC).date() - timedelta(days=1)
    assert (to - date.fromisoformat(body["from"])).days == 90


def test_stats_need_a_session(db_session: Session) -> None:
    assert make_client(db_session).get("/stats/weekly-volume").status_code == 401


# Weekly volume


def test_weekly_volume_is_zero_filled(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    session = make_session(
        db_session, owner, started_at=at("2026-10-13"), ended_at=at("2026-10-13", 13)
    )
    run = make_run(db_session, owner, session, drill, 1, started_at=at("2026-10-13"))
    make_run(db_session, owner, session, drill, 2, started_at=at("2026-10-14"))
    log(db_session, owner, run, ["success", "fail", "success"], "2026-10-13")
    # A session with no attempts and no runs still counts.
    make_session(db_session, owner, started_at=at("2026-10-28"), ended_at=at("2026-10-28", 13))

    body = (
        make_client(db_session, owner)
        .get("/stats/weekly-volume", params={"from": "2026-10-05", "to": "2026-10-31"})
        .json()
    )

    assert body["items"] == [
        {"week_start": "2026-10-05", "practice_sessions": 0, "drill_runs": 0, "attempts": 0},
        {"week_start": "2026-10-12", "practice_sessions": 1, "drill_runs": 2, "attempts": 3},
        {"week_start": "2026-10-19", "practice_sessions": 0, "drill_runs": 0, "attempts": 0},
        {"week_start": "2026-10-26", "practice_sessions": 1, "drill_runs": 0, "attempts": 0},
    ]


def test_weekly_volume_with_no_data_is_all_zero_weeks(db_session: Session) -> None:
    owner = make_user(db_session)

    body = (
        make_client(db_session, owner)
        .get("/stats/weekly-volume", params={"from": "2026-10-12", "to": "2026-10-25"})
        .json()
    )

    assert [i["week_start"] for i in body["items"]] == ["2026-10-12", "2026-10-19"]
    assert all(i["attempts"] == 0 for i in body["items"])


def test_weekly_volume_excludes_voided_and_other_owners(db_session: Session) -> None:
    owner = make_user(db_session)
    other = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = new_run(db_session, owner, drill, "2026-10-13")
    log(db_session, owner, run, ["success"], "2026-10-13")
    make_attempt(
        db_session, owner, run, 2, recorded_at=at("2026-10-13"), voided_at=at("2026-10-13", 14)
    )
    other_drill = make_drill(db_session, other)
    log(
        db_session,
        other,
        new_run(db_session, other, other_drill, "2026-10-13"),
        ["success"],
        "2026-10-13",
    )

    body = (
        make_client(db_session, owner)
        .get("/stats/weekly-volume", params={"from": "2026-10-12", "to": "2026-10-18"})
        .json()
    )

    assert body["items"] == [
        {"week_start": "2026-10-12", "practice_sessions": 1, "drill_runs": 1, "attempts": 1}
    ]


# Tags


def test_tag_breakdown_counts_an_attempt_under_each_tag(db_session: Session) -> None:
    owner = make_user(db_session)
    cut = make_tag(db_session, owner, "Cut shots")
    speed = make_tag(db_session, owner, "Speed")
    unused = make_tag(db_session, owner, "Unused")
    both = make_drill(db_session, owner)
    only_cut = make_drill(db_session, owner)
    untagged = make_drill(db_session, owner)
    make_drill_tag(db_session, owner, both, cut)
    make_drill_tag(db_session, owner, both, speed)
    make_drill_tag(db_session, owner, only_cut, cut)
    run_both = new_run(db_session, owner, both, "2026-10-14")
    log(db_session, owner, run_both, ["success", "fail"], "2026-10-14")
    run_cut = new_run(db_session, owner, only_cut, "2026-10-14")
    log(db_session, owner, run_cut, ["success", "success", "partial"], "2026-10-15")
    log(
        db_session,
        owner,
        new_run(db_session, owner, untagged, "2026-10-14"),
        ["success"],
        "2026-10-14",
    )
    make_drill_tag(db_session, owner, untagged, unused)

    body = make_client(db_session, owner).get("/stats/tags", params=RANGE).json()

    assert body["from"] == "2026-10-01"
    assert body["items"][0] == {
        "tag_id": str(cut.id),
        "name": "Cut shots",
        "category": "skill",
        "drill_count": 2,
        "drill_run_count": 2,
        "attempts": 5,
        "successes": 3,
        "success_rate": 0.6,
    }
    assert [i["name"] for i in body["items"]] == ["Cut shots", "Speed", "Unused"]


def test_tags_without_attempts_in_range_are_omitted(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner, "Old")
    drill = make_drill(db_session, owner)
    make_drill_tag(db_session, owner, drill, tag)
    run = new_run(db_session, owner, drill, "2026-08-01")
    log(db_session, owner, run, ["success"], "2026-08-01")

    body = make_client(db_session, owner).get("/stats/tags", params=RANGE).json()

    assert body["items"] == []


def test_tag_breakdown_excludes_voided_and_other_owners(db_session: Session) -> None:
    owner = make_user(db_session)
    other = make_user(db_session)
    tag = make_tag(db_session, owner, "Mine")
    drill = make_drill(db_session, owner)
    make_drill_tag(db_session, owner, drill, tag)
    run = new_run(db_session, owner, drill, "2026-10-14")
    log(db_session, owner, run, ["success"], "2026-10-14")
    make_attempt(
        db_session, owner, run, 2, recorded_at=at("2026-10-14"), voided_at=at("2026-10-14", 14)
    )
    other_tag = make_tag(db_session, other, "Theirs")
    other_drill = make_drill(db_session, other)
    make_drill_tag(db_session, other, other_drill, other_tag)
    log(
        db_session,
        other,
        new_run(db_session, other, other_drill, "2026-10-14"),
        ["success"],
        "2026-10-14",
    )

    body = make_client(db_session, owner).get("/stats/tags", params=RANGE).json()

    assert [(i["name"], i["attempts"]) for i in body["items"]] == [("Mine", 1)]


def test_tags_are_ordered_by_attempts_then_name(db_session: Session) -> None:
    owner = make_user(db_session)
    names = {"B tag": 1, "A tag": 1, "Busy": 3}
    for name, count in names.items():
        tag = make_tag(db_session, owner, name)
        drill = make_drill(db_session, owner)
        make_drill_tag(db_session, owner, drill, tag)
        run = new_run(db_session, owner, drill, "2026-10-14")
        log(db_session, owner, run, ["success"] * count, "2026-10-14")

    body = make_client(db_session, owner).get("/stats/tags", params=RANGE).json()

    assert [i["name"] for i in body["items"]] == ["Busy", "A tag", "B tag"]
