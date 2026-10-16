"""Attempts within a drill run (docs/architecture.md sections 4.4 and 4.5).

Individual attempts are recorded; totals and rates are derived. Undo sets voided_at, and
voided attempts are ignored by set numbering and success rate.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ErrorDetail, NotFoundError, ValidationFailedError
from app.db.session import violated_constraint
from app.models import Attempt, DrillRun, DrillVersion, User
from app.schemas.attempt import AttemptCreate, AttemptRead, AttemptUpdate, Outcome
from app.schemas.scoring import PointsScoring, Scoring, TimedScoring
from app.services import session_service
from app.services.scoring_service import parse_scoring

_IDEMPOTENCY_KEY_CONSTRAINT = "uq_attempts_owner_id_idempotency_key"


def create_attempt(
    db: Session,
    owner: User,
    run_id: uuid.UUID,
    idempotency_key: uuid.UUID,
    data: AttemptCreate,
) -> tuple[AttemptRead, bool]:
    """Log an attempt. Returns it and whether it is new: a replayed Idempotency-Key returns
    the original attempt instead of adding another."""
    run = session_service.get_owned_drill_run(db, owner, run_id, lock=True)
    existing = _attempt_by_key(db, owner, idempotency_key)
    if existing is not None:
        if existing.drill_run_id != run.id:
            raise _key_conflict()
        return _read(db, run, existing), False

    practice_session = session_service.lock_session(db, run.practice_session_id)
    if practice_session.ended_at is not None:
        raise session_service.session_ended()
    if run.ended_at is not None:
        raise session_service.drill_run_ended()

    scoring = _scoring_of(db, run)
    outcome, points, duration_ms = _resolve_new(scoring, data)
    next_number = (
        db.scalar(
            select(func.coalesce(func.max(Attempt.attempt_number), 0)).where(
                Attempt.drill_run_id == run.id
            )
        )
        or 0
    ) + 1
    attempt = Attempt(
        owner_id=owner.id,
        drill_run_id=run.id,
        attempt_number=next_number,
        outcome=outcome,
        points=points,
        duration_ms=duration_ms,
        idempotency_key=idempotency_key,
        tapped_at=data.tapped_at or datetime.now(UTC),
        notes=data.notes,
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if violated_constraint(exc) == _IDEMPOTENCY_KEY_CONSTRAINT:
            raise _key_conflict() from exc
        raise
    return _read(db, run, attempt), True


def update_attempt(
    db: Session, owner: User, attempt_id: uuid.UUID, data: AttemptUpdate
) -> AttemptRead:
    """Correct an attempt in place, or undo (or restore) it with voided_at."""
    attempt = db.scalar(
        select(Attempt).where(Attempt.id == attempt_id, Attempt.owner_id == owner.id)
    )
    if attempt is None:
        raise NotFoundError("Attempt")
    run = session_service.get_owned_drill_run(db, owner, attempt.drill_run_id, lock=True)
    db.refresh(attempt)
    scoring = _scoring_of(db, run)

    if data.points is not None or data.outcome is not None or data.duration_ms is not None:
        _apply_correction(scoring, attempt, data)
    if "voided_at" in data.model_fields_set:
        # Undo never fails on clock skew: a time before receipt counts as receipt.
        attempt.voided_at = (
            None if data.voided_at is None else max(data.voided_at, attempt.recorded_at)
        )
    if "notes" in data.model_fields_set:
        attempt.notes = data.notes
    db.commit()
    return _read(db, run, attempt)


def _apply_correction(scoring: Scoring, attempt: Attempt, data: AttemptUpdate) -> None:
    if isinstance(scoring, PointsScoring):
        if data.points is not None:
            _check_points(scoring, data.points)
            attempt.points = data.points
            attempt.outcome = _derive_outcome(scoring, data.points)
    elif data.points is not None:
        raise _invalid("points_not_allowed", "points only apply to points scoring.", "points")
    elif data.outcome is not None:
        attempt.outcome = data.outcome
    if data.duration_ms is not None:
        attempt.duration_ms = data.duration_ms


def _resolve_new(scoring: Scoring, data: AttemptCreate) -> tuple[Outcome, int | None, int | None]:
    """Outcome, points and duration to store, checked against the scoring kind."""
    if isinstance(scoring, PointsScoring):
        if data.points is None:
            raise _invalid("points_required", "points is required for points scoring.", "points")
        _check_points(scoring, data.points)
        return _derive_outcome(scoring, data.points), data.points, data.duration_ms
    if data.outcome is None:
        raise _invalid("outcome_required", "outcome is required.", "outcome")
    if isinstance(scoring, TimedScoring) and data.duration_ms is None:
        raise _invalid(
            "duration_required", "duration_ms is required for timed scoring.", "duration_ms"
        )
    return data.outcome, None, data.duration_ms


def _derive_outcome(scoring: PointsScoring, points: int) -> Outcome:
    """0 is a fail, the maximum is a success, anything else is partial (section 4.4)."""
    if points == 0:
        return "fail"
    if points == scoring.max_points_per_attempt:
        return "success"
    return "partial"


def _check_points(scoring: PointsScoring, points: int) -> None:
    if points > scoring.max_points_per_attempt:
        raise _invalid(
            "points_too_high",
            f"points can be at most {scoring.max_points_per_attempt}.",
            "points",
        )


def _invalid(code: str, message: str, field: str) -> ValidationFailedError:
    return ValidationFailedError(
        "The attempt is invalid.", [ErrorDetail(code=code, message=message, path=[field])]
    )


def _key_conflict() -> ConflictError:
    return ConflictError(
        "idempotency_key_conflict",
        "This Idempotency-Key was already used for a different drill run.",
    )


def _attempt_by_key(db: Session, owner: User, key: uuid.UUID) -> Attempt | None:
    return db.scalar(
        select(Attempt).where(Attempt.owner_id == owner.id, Attempt.idempotency_key == key)
    )


def _scoring_of(db: Session, run: DrillRun) -> Scoring:
    version = db.get(DrillVersion, run.drill_version_id)
    assert version is not None
    return parse_scoring(version.scoring)


def _read(db: Session, run: DrillRun, attempt: Attempt) -> AttemptRead:
    return AttemptRead(
        id=attempt.id,
        drill_run_id=attempt.drill_run_id,
        attempt_number=attempt.attempt_number,
        outcome=attempt.outcome,
        points=attempt.points,
        duration_ms=attempt.duration_ms,
        tapped_at=attempt.tapped_at,
        recorded_at=attempt.recorded_at,
        voided_at=attempt.voided_at,
        notes=attempt.notes,
        set_progress=session_service.progress_for_run(db, run),
    )
