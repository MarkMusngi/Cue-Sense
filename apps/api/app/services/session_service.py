"""Practice sessions and drill runs, scoped to their owner (docs/architecture.md section 4.5).

An owner has at most one open session. Whenever a session is loaded, one that has had no
activity for SESSION_IDLE_HOURS is closed at its last activity, together with its open
drill runs. There is no background job.
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ErrorDetail, NotFoundError, ValidationFailedError
from app.core.settings import get_settings
from app.db.session import violated_constraint
from app.models import Attempt, Drill, DrillRun, DrillVersion, PracticeSession, User
from app.schemas.common import Page, Pagination
from app.schemas.practice_session import (
    DrillRunCreate,
    DrillRunRead,
    DrillRunUpdate,
    PracticeSessionCreate,
    PracticeSessionDetail,
    PracticeSessionRead,
    PracticeSessionUpdate,
)
from app.schemas.scoring import ScoredAttempt, SetProgress
from app.services.scoring_service import compute_set_progress, parse_scoring

_OPEN_SESSION_INDEX = "ix_practice_sessions_owner_id_open_unique"


def session_ended() -> ConflictError:
    return ConflictError("session_ended", "The practice session has ended.")


def drill_run_ended() -> ConflictError:
    return ConflictError("drill_run_ended", "The drill run has ended.")


def _ended_before_started() -> ValidationFailedError:
    return ValidationFailedError(
        "The end time is invalid.",
        [
            ErrorDetail(
                code="ended_before_started",
                message="ended_at cannot be before started_at.",
                path=["ended_at"],
            )
        ],
    )


def _check_end_time(ended_at: datetime, started_at: datetime) -> None:
    if ended_at < started_at:
        raise _ended_before_started()
    # A little slack for client clocks; further ahead is a bug, not skew.
    if ended_at > datetime.now(UTC) + timedelta(minutes=1):
        raise ValidationFailedError(
            "The end time is invalid.",
            [
                ErrorDetail(
                    code="ended_in_future",
                    message="ended_at cannot be in the future.",
                    path=["ended_at"],
                )
            ],
        )


def lock_session(db: Session, session_id: uuid.UUID) -> PracticeSession:
    """Lock the session row and reload it, so ended_at is checked after any concurrent end."""
    practice_session = db.scalar(
        select(PracticeSession)
        .where(PracticeSession.id == session_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    assert practice_session is not None
    return practice_session


# Sessions


def start_session(db: Session, owner: User, data: PracticeSessionCreate) -> PracticeSessionRead:
    """Start a session, closing the owner's open one first."""
    open_session = _open_session(db, owner)
    if open_session is not None:
        if not _close_if_idle(db, open_session):
            _close_session(db, open_session, datetime.now(UTC))
            db.flush()
    practice_session = PracticeSession(owner_id=owner.id, location=data.location, notes=data.notes)
    db.add(practice_session)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Two requests raced to start a session; the other one won.
        if violated_constraint(exc) == _OPEN_SESSION_INDEX:
            raise ConflictError(
                "session_conflict", "Another practice session was started at the same time."
            ) from exc
        raise
    return PracticeSessionRead.model_validate(practice_session, from_attributes=True)


def list_sessions(db: Session, owner: User, pagination: Pagination) -> Page[PracticeSessionRead]:
    open_session = _open_session(db, owner)
    if open_session is not None:
        _close_if_idle(db, open_session)
    query = select(PracticeSession).where(PracticeSession.owner_id == owner.id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    sessions = db.scalars(
        query.order_by(PracticeSession.started_at.desc(), PracticeSession.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    return Page(
        items=[PracticeSessionRead.model_validate(s, from_attributes=True) for s in sessions],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


def get_session(db: Session, owner: User, session_id: uuid.UUID) -> PracticeSessionDetail:
    practice_session = get_owned_session(db, owner, session_id)
    runs = db.scalars(
        select(DrillRun)
        .where(DrillRun.practice_session_id == practice_session.id)
        .order_by(DrillRun.run_number)
    ).all()
    base = PracticeSessionRead.model_validate(practice_session, from_attributes=True)
    return PracticeSessionDetail(**base.model_dump(), drill_runs=read_runs(db, runs))


def update_session(
    db: Session, owner: User, session_id: uuid.UUID, data: PracticeSessionUpdate
) -> PracticeSessionRead:
    practice_session = get_owned_session(db, owner, session_id)
    if data.ended_at is not None:
        if practice_session.ended_at is not None:
            raise session_ended()
        _check_end_time(data.ended_at, practice_session.started_at)
        _close_session(db, practice_session, data.ended_at)
    if "location" in data.model_fields_set:
        practice_session.location = data.location
    if "notes" in data.model_fields_set:
        practice_session.notes = data.notes
    db.commit()
    return PracticeSessionRead.model_validate(practice_session, from_attributes=True)


def get_owned_session(db: Session, owner: User, session_id: uuid.UUID) -> PracticeSession:
    """The owner's session, closed first if it has gone idle. 404 for anyone else's."""
    practice_session = db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == session_id, PracticeSession.owner_id == owner.id
        )
    )
    if practice_session is None:
        raise NotFoundError("Practice session")
    _close_if_idle(db, practice_session)
    return practice_session


def _open_session(db: Session, owner: User) -> PracticeSession | None:
    return db.scalar(
        select(PracticeSession).where(
            PracticeSession.owner_id == owner.id, PracticeSession.ended_at.is_(None)
        )
    )


def _close_session(db: Session, practice_session: PracticeSession, ended_at: datetime) -> None:
    """End the session and its open drill runs; a run never ends before it started."""
    practice_session.ended_at = ended_at
    db.execute(
        update(DrillRun)
        .where(DrillRun.practice_session_id == practice_session.id, DrillRun.ended_at.is_(None))
        .values(ended_at=func.greatest(ended_at, DrillRun.started_at))
        .execution_options(synchronize_session="fetch")
    )


def _close_if_idle(db: Session, practice_session: PracticeSession) -> bool:
    """Close an open session with no activity for SESSION_IDLE_HOURS, at its last activity.

    Activity is the latest non-voided attempt's recorded_at, or started_at without one."""
    if practice_session.ended_at is not None:
        return False
    last_attempt = db.scalar(
        select(func.max(Attempt.recorded_at))
        .join(DrillRun, Attempt.drill_run_id == DrillRun.id)
        .where(DrillRun.practice_session_id == practice_session.id, Attempt.voided_at.is_(None))
    )
    activity = max(last_attempt or practice_session.started_at, practice_session.started_at)
    idle_for = timedelta(hours=get_settings().session_idle_hours)
    if datetime.now(UTC) - activity < idle_for:
        return False
    _close_session(db, practice_session, activity)
    db.commit()
    return True


# Drill runs


def start_drill_run(
    db: Session, owner: User, session_id: uuid.UUID, data: DrillRunCreate
) -> DrillRunRead:
    """Start a drill run on the drill's current version."""
    get_owned_session(db, owner, session_id)
    drill = db.scalar(select(Drill).where(Drill.id == data.drill_id, Drill.owner_id == owner.id))
    if drill is None:
        raise NotFoundError("Drill")
    # Locking also serializes concurrent starts, so their runs are numbered one after another.
    practice_session = lock_session(db, session_id)
    if practice_session.ended_at is not None:
        raise session_ended()
    if drill.status == "archived" or drill.current_drill_version_id is None:
        raise ConflictError(
            "drill_archived", "An archived drill cannot start a drill run. Unarchive it first."
        )
    # Lock the session so concurrent starts number their runs one after the other.
    db.execute(select(PracticeSession.id).where(PracticeSession.id == session_id).with_for_update())
    run_number = (
        db.scalar(
            select(func.coalesce(func.max(DrillRun.run_number), 0)).where(
                DrillRun.practice_session_id == session_id
            )
        )
        or 0
    ) + 1
    run = DrillRun(
        owner_id=owner.id,
        practice_session_id=session_id,
        drill_id=drill.id,
        drill_version_id=drill.current_drill_version_id,
        run_number=run_number,
    )
    db.add(run)
    db.commit()
    return read_run(db, run)


def get_drill_run(db: Session, owner: User, run_id: uuid.UUID) -> DrillRunRead:
    return read_run(db, get_owned_drill_run(db, owner, run_id))


def update_drill_run(
    db: Session, owner: User, run_id: uuid.UUID, data: DrillRunUpdate
) -> DrillRunRead:
    run = get_owned_drill_run(db, owner, run_id)
    if data.ended_at is not None:
        if run.ended_at is not None:
            raise drill_run_ended()
        _check_end_time(data.ended_at, run.started_at)
        run.ended_at = data.ended_at
    if "notes" in data.model_fields_set:
        run.notes = data.notes
    db.commit()
    return read_run(db, run)


def get_owned_drill_run(
    db: Session, owner: User, run_id: uuid.UUID, lock: bool = False
) -> DrillRun:
    """The owner's drill run, with its session closed first if it has gone idle."""
    query = select(DrillRun).where(DrillRun.id == run_id, DrillRun.owner_id == owner.id)
    run = db.scalar(query)
    if run is None:
        raise NotFoundError("Drill run")
    practice_session = db.get(PracticeSession, run.practice_session_id)
    assert practice_session is not None
    _close_if_idle(db, practice_session)
    if lock:
        db.execute(select(DrillRun.id).where(DrillRun.id == run.id).with_for_update())
    db.refresh(run)
    return run


# Reading runs with their set progress


def read_run(db: Session, run: DrillRun) -> DrillRunRead:
    return read_runs(db, [run])[0]


def read_runs(db: Session, runs: Sequence[DrillRun]) -> list[DrillRunRead]:
    """Runs with set progress, loading all their attempts in one query."""
    if not runs:
        return []
    run_ids = [run.id for run in runs]
    attempts = db.execute(
        select(Attempt.drill_run_id, Attempt.outcome, Attempt.points, Attempt.voided_at)
        .where(Attempt.drill_run_id.in_(run_ids))
        .order_by(Attempt.drill_run_id, Attempt.attempt_number)
    ).all()
    by_run: dict[uuid.UUID, list[ScoredAttempt]] = {run_id: [] for run_id in run_ids}
    for run_id, outcome, points, voided_at in attempts:
        by_run[run_id].append(
            ScoredAttempt(outcome=outcome, points=points, is_voided=voided_at is not None)
        )
    scorings = {
        version_id: parse_scoring(scoring)
        for version_id, scoring in db.execute(
            select(DrillVersion.id, DrillVersion.scoring).where(
                DrillVersion.id.in_({run.drill_version_id for run in runs})
            )
        )
    }
    return [
        DrillRunRead(
            id=run.id,
            practice_session_id=run.practice_session_id,
            drill_id=run.drill_id,
            drill_version_id=run.drill_version_id,
            run_number=run.run_number,
            started_at=run.started_at,
            ended_at=run.ended_at,
            notes=run.notes,
            set_progress=compute_set_progress(scorings[run.drill_version_id], by_run[run.id]),
        )
        for run in runs
    ]


def progress_for_run(db: Session, run: DrillRun) -> SetProgress:
    return read_run(db, run).set_progress
