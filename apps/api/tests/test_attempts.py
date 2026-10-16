import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Attempt, DrillRun, PracticeSession, User
from tests.conftest import make_client
from tests.factories import make_attempt, make_drill, make_run, make_session, make_user

POINTS_SCORING: dict[str, Any] = {
    "schema_version": 1,
    "kind": "points",
    "attempts_per_set": 3,
    "max_points_per_attempt": 3,
    "pass_threshold": 6,
}
TIMED_SCORING: dict[str, Any] = {
    "schema_version": 1,
    "kind": "timed",
    "attempts_per_set": 3,
    "time_limit_seconds": 90,
    "pass_threshold": 2,
}
STREAK_SCORING: dict[str, Any] = {"schema_version": 1, "kind": "streak", "streak_length": 3}
SMALL_SET_SCORING: dict[str, Any] = {
    "schema_version": 1,
    "kind": "success_count",
    "attempts_per_set": 3,
    "pass_threshold": 2,
}


def ago(**kwargs: float) -> datetime:
    return datetime.now(UTC) - timedelta(**kwargs)


def setup_run(
    db: Session, scoring: dict[str, Any] | None = None
) -> tuple[User, DrillRun, TestClient]:
    """An owner with an open session and a drill run (default scoring: 7 of 10)."""
    owner = make_user(db)
    fields: dict[str, Any] = {"scoring": scoring} if scoring else {}
    drill = make_drill(db, owner, **fields)
    run = make_run(db, owner, make_session(db, owner), drill)
    return owner, run, make_client(db, owner)


def post_attempt(
    client: TestClient, run: DrillRun, key: uuid.UUID | None = None, **body: Any
) -> Any:
    headers = {"Idempotency-Key": str(key or uuid.uuid4())}
    return client.post(f"/drill-runs/{run.id}/attempts", json=body, headers=headers)


def attempt_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Attempt)) or 0


# Create


def test_log_attempts_numbers_them_per_drill_run(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    session = db_session.get(PracticeSession, run.practice_session_id)
    assert session is not None
    other_run = make_run(db_session, owner, session, make_drill(db_session, owner), 2)

    first = post_attempt(client, run, outcome="success")
    second = post_attempt(client, run, outcome="fail")
    other = post_attempt(client, other_run, outcome="success")

    assert first.status_code == 201
    assert [first.json()["attempt_number"], second.json()["attempt_number"]] == [1, 2]
    assert other.json()["attempt_number"] == 1
    body = second.json()
    assert body["outcome"] == "fail"
    assert body["voided_at"] is None
    assert body["set_progress"]["attempts_in_set"] == 2
    assert body["set_progress"]["successes"] == 1


def test_idempotency_key_header_is_required(db_session: Session) -> None:
    _, run, client = setup_run(db_session)

    response = client.post(f"/drill-runs/{run.id}/attempts", json={"outcome": "success"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert attempt_count(db_session) == 0


def test_idempotency_key_must_be_a_uuid(db_session: Session) -> None:
    _, run, client = setup_run(db_session)

    response = client.post(
        f"/drill-runs/{run.id}/attempts",
        json={"outcome": "success"},
        headers={"Idempotency-Key": "not-a-uuid"},
    )

    assert response.status_code == 422


def test_replayed_key_returns_the_original_attempt_without_a_duplicate(
    db_session: Session,
) -> None:
    _, run, client = setup_run(db_session)
    key = uuid.uuid4()

    first = post_attempt(client, run, key, outcome="success")
    replay = post_attempt(client, run, key, outcome="success")

    assert first.status_code == 201
    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    assert replay.json()["attempt_number"] == 1
    assert attempt_count(db_session) == 1


def test_replay_still_works_after_the_session_ended(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    key = uuid.uuid4()
    first = post_attempt(client, run, key, outcome="success")
    session = db_session.get(PracticeSession, run.practice_session_id)
    assert session is not None
    session.ended_at = datetime.now(UTC)
    db_session.flush()

    replay = post_attempt(client, run, key, outcome="success")

    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]


def test_key_reused_on_another_drill_run_is_409(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    session = db_session.get(PracticeSession, run.practice_session_id)
    assert session is not None
    other_run = make_run(db_session, owner, session, make_drill(db_session, owner), 2)
    key = uuid.uuid4()
    post_attempt(client, run, key, outcome="success")

    response = post_attempt(client, other_run, key, outcome="success")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "idempotency_key_conflict"
    assert attempt_count(db_session) == 1


def test_attempts_in_an_ended_session_are_409(db_session: Session) -> None:
    owner = make_user(db_session)
    session = make_session(db_session, owner, ended=True, started_at=ago(hours=2))
    run = make_run(db_session, owner, session, make_drill(db_session, owner))

    response = post_attempt(make_client(db_session, owner), run, outcome="success")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "session_ended"
    assert attempt_count(db_session) == 0


def test_attempts_in_an_ended_drill_run_are_409(db_session: Session) -> None:
    owner = make_user(db_session)
    session = make_session(db_session, owner, started_at=ago(hours=2))
    run = make_run(
        db_session,
        owner,
        session,
        make_drill(db_session, owner),
        started_at=ago(hours=2),
        ended_at=ago(hours=1),
    )

    response = post_attempt(make_client(db_session, owner), run, outcome="success")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "drill_run_ended"


def test_attempt_in_an_idle_session_closes_it_and_is_409(db_session: Session) -> None:
    owner = make_user(db_session)
    started = ago(hours=8)
    session = make_session(db_session, owner, started_at=started)
    run = make_run(db_session, owner, session, make_drill(db_session, owner), started_at=started)

    response = post_attempt(make_client(db_session, owner), run, outcome="success")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "session_ended"
    db_session.refresh(session)
    assert session.ended_at == started


def test_success_count_requires_an_outcome(db_session: Session) -> None:
    _, run, client = setup_run(db_session)

    response = post_attempt(client, run)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "outcome_required"


def test_points_attempt_derives_the_outcome(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)

    outcomes = [post_attempt(client, run, points=p).json()["outcome"] for p in (0, 2, 3)]

    assert outcomes == ["fail", "partial", "success"]


def test_points_attempt_ignores_a_client_outcome(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)

    response = post_attempt(client, run, points=0, outcome="success")

    assert response.json()["outcome"] == "fail"


def test_points_attempt_needs_points_within_the_maximum(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)

    missing = post_attempt(client, run, outcome="success")
    too_high = post_attempt(client, run, points=4)

    assert missing.json()["error"]["details"][0]["code"] == "points_required"
    assert too_high.status_code == 422
    assert too_high.json()["error"]["details"][0]["code"] == "points_too_high"
    assert attempt_count(db_session) == 0


def test_points_progress_totals_the_set(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)

    for points in (3, 3):
        post_attempt(client, run, points=points)
    body = post_attempt(client, run, points=0).json()

    progress = body["set_progress"]
    assert (progress["points"], progress["set_complete"], progress["set_passed"]) == (6, True, True)


def test_timed_attempt_requires_duration(db_session: Session) -> None:
    _, run, client = setup_run(db_session, TIMED_SCORING)

    missing = post_attempt(client, run, outcome="success")
    ok = post_attempt(client, run, outcome="success", duration_ms=45_000)

    assert missing.status_code == 422
    assert missing.json()["error"]["details"][0]["code"] == "duration_required"
    assert ok.status_code == 201
    assert ok.json()["duration_ms"] == 45_000


def test_streak_progress_in_the_response(db_session: Session) -> None:
    _, run, client = setup_run(db_session, STREAK_SCORING)

    for outcome in ("success", "success", "success"):
        body = post_attempt(client, run, outcome=outcome).json()

    progress = body["set_progress"]
    assert (progress["current_streak"], progress["best_streak"]) == (3, 3)
    assert progress["set_passed"] is True


def test_negative_numbers_are_rejected(db_session: Session) -> None:
    _, run, client = setup_run(db_session, TIMED_SCORING)

    response = post_attempt(client, run, outcome="success", duration_ms=-1)

    assert response.status_code == 422


def test_tapped_at_is_kept_apart_from_recorded_at(db_session: Session) -> None:
    _, run, client = setup_run(db_session)
    tapped = ago(seconds=30)

    body = post_attempt(client, run, outcome="success", tapped_at=tapped.isoformat()).json()

    assert datetime.fromisoformat(body["tapped_at"]) == tapped
    assert datetime.fromisoformat(body["recorded_at"]) > tapped


# Update and undo


def test_correct_an_outcome(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    attempt = make_attempt(db_session, owner, run, 1, outcome="fail")

    response = client.patch(f"/attempts/{attempt.id}", json={"outcome": "success", "notes": "Oops"})

    assert response.status_code == 200
    body = response.json()
    assert (body["outcome"], body["notes"]) == ("success", "Oops")
    assert body["set_progress"]["successes"] == 1


def test_correct_points_rederives_the_outcome(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)
    attempt_id = post_attempt(client, run, points=3).json()["id"]

    body = client.patch(f"/attempts/{attempt_id}", json={"points": 1}).json()

    assert (body["points"], body["outcome"]) == (1, "partial")
    assert body["set_progress"]["points"] == 1


def test_correct_points_above_the_maximum_is_422(db_session: Session) -> None:
    _, run, client = setup_run(db_session, POINTS_SCORING)
    attempt_id = post_attempt(client, run, points=3).json()["id"]

    response = client.patch(f"/attempts/{attempt_id}", json={"points": 9})

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "points_too_high"


def test_correct_duration(db_session: Session) -> None:
    _, run, client = setup_run(db_session, TIMED_SCORING)
    attempt_id = post_attempt(client, run, outcome="fail", duration_ms=100_000).json()["id"]

    body = client.patch(f"/attempts/{attempt_id}", json={"duration_ms": 80_000}).json()

    assert body["duration_ms"] == 80_000


def test_undo_voids_the_attempt_and_leaves_set_numbering_and_rate(db_session: Session) -> None:
    _, run, client = setup_run(db_session, SMALL_SET_SCORING)
    ids = [post_attempt(client, run, outcome=o).json()["id"] for o in ("success", "fail", "fail")]

    undone = client.patch(f"/attempts/{ids[1]}", json={"voided_at": ago(seconds=-1).isoformat()})

    assert undone.status_code == 200
    assert undone.json()["voided_at"] is not None
    progress = undone.json()["set_progress"]
    assert (progress["attempts_in_set"], progress["successes"]) == (2, 1)
    assert progress["set_complete"] is False
    assert progress["success_rate"] == 0.5
    # The next attempt fills the set again; numbers are never reused, positions are.
    next_attempt = post_attempt(client, run, outcome="success").json()
    assert next_attempt["attempt_number"] == 4
    assert next_attempt["set_progress"]["set_number"] == 1
    assert next_attempt["set_progress"]["set_complete"] is True


def test_undo_before_it_was_recorded_is_clamped_to_the_receipt_time(db_session: Session) -> None:
    _, run, client = setup_run(db_session)
    created = post_attempt(client, run, outcome="success").json()

    body = client.patch(
        f"/attempts/{created['id']}", json={"voided_at": ago(days=1).isoformat()}
    ).json()

    assert body["voided_at"] == created["recorded_at"]


def test_null_voided_at_restores_the_attempt(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    attempt = make_attempt(
        db_session, owner, run, 1, outcome="success", voided_at=datetime.now(UTC)
    )

    body = client.patch(f"/attempts/{attempt.id}", json={"voided_at": None}).json()

    assert body["voided_at"] is None
    assert body["set_progress"]["attempts_in_set"] == 1


def test_attempts_can_be_corrected_after_the_session_ended(db_session: Session) -> None:
    owner = make_user(db_session)
    session = make_session(db_session, owner, ended=True, started_at=ago(hours=2))
    run = make_run(db_session, owner, session, make_drill(db_session, owner))
    attempt = make_attempt(db_session, owner, run, 1, outcome="fail")

    response = make_client(db_session, owner).patch(
        f"/attempts/{attempt.id}", json={"outcome": "success"}
    )

    assert response.status_code == 200
    assert response.json()["outcome"] == "success"


def test_another_owners_attempt_is_404(db_session: Session) -> None:
    other, run, _ = setup_run(db_session)
    attempt = make_attempt(db_session, other, run, 1)
    intruder = make_client(db_session, make_user(db_session))

    response = intruder.patch(f"/attempts/{attempt.id}", json={"outcome": "fail"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    db_session.refresh(attempt)
    assert attempt.outcome == "success"


def test_unknown_fields_are_rejected(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    attempt = make_attempt(db_session, owner, run, 1)

    response = client.patch(f"/attempts/{attempt.id}", json={"attempt_number": 9})

    assert response.status_code == 422


def test_correcting_points_on_a_non_points_drill_is_422(db_session: Session) -> None:
    owner, run, client = setup_run(db_session)
    attempt = make_attempt(db_session, owner, run, 1, outcome="fail")

    response = client.patch(f"/attempts/{attempt.id}", json={"points": 2})

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "points_not_allowed"
