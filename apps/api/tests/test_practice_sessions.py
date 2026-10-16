import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DrillRun, PracticeSession
from tests.conftest import make_client
from tests.factories import (
    make_attempt,
    make_drill,
    make_run,
    make_session,
    make_user,
    make_version,
)


def ago(**kwargs: float) -> datetime:
    return datetime.now(UTC) - timedelta(**kwargs)


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


def open_session_count(db: Session, owner_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count()).where(
                PracticeSession.owner_id == owner_id, PracticeSession.ended_at.is_(None)
            )
        )
        or 0
    )


def attempt_headers() -> dict[str, str]:
    return {"Idempotency-Key": str(uuid.uuid4())}


# Start, list, detail


def test_start_a_session(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post(
        "/practice-sessions", json={"location": "Home table", "notes": "Warm-up"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["ended_at"] is None
    assert body["location"] == "Home table"
    assert body["notes"] == "Warm-up"


def test_starting_a_session_closes_the_open_one_and_its_runs(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    old = make_session(db_session, owner, started_at=ago(hours=1))
    run = make_run(db_session, owner, old, drill, started_at=ago(minutes=50))

    response = make_client(db_session, owner).post("/practice-sessions", json={})

    assert response.status_code == 201
    assert open_session_count(db_session, owner.id) == 1
    db_session.refresh(old)
    db_session.refresh(run)
    assert old.ended_at is not None
    assert run.ended_at == old.ended_at


def test_starting_a_session_does_not_touch_another_owners_session(db_session: Session) -> None:
    owner = make_user(db_session)
    other_session = make_session(db_session, make_user(db_session))

    make_client(db_session, owner).post("/practice-sessions", json={})

    db_session.refresh(other_session)
    assert other_session.ended_at is None


def test_list_sessions_is_paginated_newest_first_and_owner_scoped(db_session: Session) -> None:
    owner = make_user(db_session)
    for hours in (30, 20, 10):
        make_session(
            db_session,
            owner,
            started_at=ago(hours=hours + 1),
            ended_at=ago(hours=hours),
        )
    make_session(db_session, make_user(db_session), ended=True)

    page = make_client(db_session, owner).get(
        "/practice-sessions", params={"limit": 2, "offset": 1}
    )

    body = page.json()
    assert body["total"] == 3
    assert (body["limit"], body["offset"]) == (2, 1)
    assert len(body["items"]) == 2
    started = [parse(item["started_at"]) for item in body["items"]]
    assert started == sorted(started, reverse=True)


def test_list_rejects_a_limit_over_100(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get("/practice-sessions", params={"limit": 101})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_session_detail_includes_drill_runs_with_set_progress(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner)
    run = make_run(db_session, owner, practice_session, drill)
    make_attempt(db_session, owner, run, 1, outcome="success")
    make_attempt(db_session, owner, run, 2, outcome="fail")

    body = make_client(db_session, owner).get(f"/practice-sessions/{practice_session.id}").json()

    assert [r["id"] for r in body["drill_runs"]] == [str(run.id)]
    progress = body["drill_runs"][0]["set_progress"]
    assert (progress["attempts_in_set"], progress["successes"]) == (2, 1)


def test_another_owners_session_is_404(db_session: Session) -> None:
    owner = make_user(db_session)
    other_session = make_session(db_session, make_user(db_session))
    client = make_client(db_session, owner)
    url = f"/practice-sessions/{other_session.id}"

    assert client.get(url).status_code == 404
    assert client.patch(url, json={"notes": "x"}).status_code == 404
    response = client.post(f"{url}/drill-runs", json={"drill_id": str(uuid.uuid4())})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# Update


def test_finish_a_session_and_close_its_open_runs(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner, started_at=ago(hours=1))
    run = make_run(db_session, owner, practice_session, drill, started_at=ago(minutes=50))
    ended_at = ago(minutes=5)

    response = make_client(db_session, owner).patch(
        f"/practice-sessions/{practice_session.id}", json={"ended_at": ended_at.isoformat()}
    )

    assert response.status_code == 200
    assert parse(response.json()["ended_at"]) == ended_at
    db_session.refresh(run)
    assert run.ended_at == ended_at


def test_update_location_and_notes_and_clear_them(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner, location="Club", notes="Hi")
    client = make_client(db_session, owner)
    url = f"/practice-sessions/{practice_session.id}"

    changed = client.patch(url, json={"location": "Home"}).json()
    cleared = client.patch(url, json={"notes": None}).json()

    assert (changed["location"], changed["notes"]) == ("Home", "Hi")
    assert (cleared["location"], cleared["notes"]) == ("Home", None)


def test_finishing_a_finished_session_is_409(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner, ended=True, started_at=ago(hours=2))

    response = make_client(db_session, owner).patch(
        f"/practice-sessions/{practice_session.id}", json={"ended_at": ago(minutes=1).isoformat()}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "session_ended"


def test_finishing_before_the_start_is_422(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner, started_at=ago(hours=1))

    response = make_client(db_session, owner).patch(
        f"/practice-sessions/{practice_session.id}", json={"ended_at": ago(hours=2).isoformat()}
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "ended_before_started"


# Idle auto-close


def test_idle_session_without_attempts_closes_at_its_start_on_load(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    started = ago(hours=8)
    practice_session = make_session(db_session, owner, started_at=started)
    run = make_run(db_session, owner, practice_session, drill, started_at=started)

    body = make_client(db_session, owner).get(f"/practice-sessions/{practice_session.id}").json()

    assert parse(body["ended_at"]) == started
    assert parse(body["drill_runs"][0]["ended_at"]) == started
    db_session.refresh(run)
    assert run.ended_at == started


def test_idle_session_closes_at_its_last_non_voided_attempt(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner, started_at=ago(hours=12))
    run = make_run(db_session, owner, practice_session, drill, started_at=ago(hours=12))
    last = ago(hours=9)
    make_attempt(db_session, owner, run, 1, recorded_at=ago(hours=10))
    make_attempt(db_session, owner, run, 2, recorded_at=last)
    make_attempt(db_session, owner, run, 3, recorded_at=ago(hours=8), voided_at=ago(hours=7))

    body = make_client(db_session, owner).get(f"/practice-sessions/{practice_session.id}").json()

    assert parse(body["ended_at"]) == last


def test_recent_activity_keeps_a_long_session_open(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner, started_at=ago(hours=12))
    run = make_run(db_session, owner, practice_session, drill, started_at=ago(hours=12))
    make_attempt(db_session, owner, run, 1, recorded_at=ago(hours=1))

    body = make_client(db_session, owner).get(f"/practice-sessions/{practice_session.id}").json()

    assert body["ended_at"] is None


def test_listing_closes_an_idle_session(db_session: Session) -> None:
    owner = make_user(db_session)
    started = ago(hours=8)
    make_session(db_session, owner, started_at=started)

    items = make_client(db_session, owner).get("/practice-sessions").json()["items"]

    assert parse(items[0]["ended_at"]) == started
    assert open_session_count(db_session, owner.id) == 0


def test_starting_a_session_closes_an_idle_one_at_its_last_activity(db_session: Session) -> None:
    owner = make_user(db_session)
    started = ago(hours=8)
    idle = make_session(db_session, owner, started_at=started)

    make_client(db_session, owner).post("/practice-sessions", json={})

    db_session.refresh(idle)
    assert idle.ended_at == started
    assert open_session_count(db_session, owner.id) == 1


# Drill runs


def test_start_a_drill_run_pins_the_current_version(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner)
    client = make_client(db_session, owner)
    url = f"/practice-sessions/{practice_session.id}/drill-runs"

    first = client.post(url, json={"drill_id": str(drill.id)})
    version_1 = drill.current_drill_version_id
    version_2 = make_version(db_session, drill, 2)
    drill.current_drill_version_id = version_2.id
    db_session.flush()
    second = client.post(url, json={"drill_id": str(drill.id)})

    assert first.status_code == 201
    assert first.json()["drill_version_id"] == str(version_1)
    assert first.json()["run_number"] == 1
    assert first.json()["set_progress"]["attempts_in_set"] == 0
    assert second.json()["drill_version_id"] == str(version_2.id)
    assert second.json()["run_number"] == 2
    # Editing the drill after the run started does not change the run.
    again = client.get(f"/drill-runs/{first.json()['id']}").json()
    assert again["drill_version_id"] == str(version_1)


def test_archived_drill_cannot_start_a_run(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner, status="archived")
    practice_session = make_session(db_session, owner)

    response = make_client(db_session, owner).post(
        f"/practice-sessions/{practice_session.id}/drill-runs", json={"drill_id": str(drill.id)}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "drill_archived"
    assert db_session.scalar(select(func.count()).select_from(DrillRun)) == 0


def test_another_owners_drill_cannot_start_a_run(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, make_user(db_session))
    practice_session = make_session(db_session, owner)

    response = make_client(db_session, owner).post(
        f"/practice-sessions/{practice_session.id}/drill-runs", json={"drill_id": str(drill.id)}
    )

    assert response.status_code == 404


def test_ended_session_cannot_start_a_run(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    practice_session = make_session(db_session, owner, ended=True, started_at=ago(hours=1))

    response = make_client(db_session, owner).post(
        f"/practice-sessions/{practice_session.id}/drill-runs", json={"drill_id": str(drill.id)}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "session_ended"


def test_end_a_drill_run_and_edit_notes(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = make_run(
        db_session, owner, make_session(db_session, owner), drill, started_at=ago(hours=1)
    )
    client = make_client(db_session, owner)
    ended_at = ago(minutes=1)
    body = {"ended_at": ended_at.isoformat(), "notes": "Good"}

    ended = client.patch(f"/drill-runs/{run.id}", json=body)
    again = client.patch(f"/drill-runs/{run.id}", json={"ended_at": ended_at.isoformat()})

    assert ended.status_code == 200
    assert parse(ended.json()["ended_at"]) == ended_at
    assert ended.json()["notes"] == "Good"
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "drill_run_ended"


def test_another_owners_drill_run_is_404(db_session: Session) -> None:
    owner = make_user(db_session)
    other = make_user(db_session)
    run = make_run(
        db_session, other, make_session(db_session, other), make_drill(db_session, other)
    )
    client = make_client(db_session, owner)

    assert client.get(f"/drill-runs/{run.id}").status_code == 404
    assert client.patch(f"/drill-runs/{run.id}", json={"notes": "x"}).status_code == 404
    response = client.post(
        f"/drill-runs/{run.id}/attempts", json={"outcome": "success"}, headers=attempt_headers()
    )
    assert response.status_code == 404


def test_drill_run_detail_reports_set_progress(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    run = make_run(db_session, owner, make_session(db_session, owner), drill)
    for number, outcome in enumerate(["success", "success", "fail"], start=1):
        make_attempt(db_session, owner, run, number, outcome=outcome)
    make_attempt(db_session, owner, run, 4, outcome="success", voided_at=datetime.now(UTC))

    body: dict[str, Any] = make_client(db_session, owner).get(f"/drill-runs/{run.id}").json()

    progress = body["set_progress"]
    assert (progress["set_number"], progress["attempts_in_set"], progress["successes"]) == (1, 3, 2)
    assert progress["success_rate"] == 2 / 3


def test_ending_in_the_future_is_422(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner, started_at=ago(hours=1))
    run = make_run(db_session, owner, practice_session, make_drill(db_session, owner))
    client = make_client(db_session, owner)
    future = (datetime.now(UTC) + timedelta(hours=3)).isoformat()

    on_session = client.patch(
        f"/practice-sessions/{practice_session.id}", json={"ended_at": future}
    )
    on_run = client.patch(f"/drill-runs/{run.id}", json={"ended_at": future})

    for response in (on_session, on_run):
        assert response.status_code == 422
        assert response.json()["error"]["details"][0]["code"] == "ended_in_future"
