"""Scoring validation and set progress (docs/architecture.md section 4.4). No I/O."""

from collections.abc import Sequence
from typing import cast

from pydantic import BaseModel, TypeAdapter, ValidationError

from app.core.errors import ErrorDetail
from app.schemas.scoring import (
    PointsScoring,
    ScoredAttempt,
    Scoring,
    SetProgress,
    StreakScoring,
    SuccessCountScoring,
    TimedScoring,
)

LATEST_SCORING_SCHEMA_VERSION = 1

# The cast keeps mypy happy across pydantic releases that type annotated unions differently.
_SCORING_ADAPTER: TypeAdapter[Scoring] = TypeAdapter(cast("type[Scoring]", Scoring))
_KINDS = {"success_count", "streak", "points", "timed"}


class ScoringValidationResult(BaseModel):
    scoring: Scoring | None
    errors: list[ErrorDetail]

    def require_scoring(self) -> Scoring:
        """Return the validated scoring, or raise ValueError if validation failed."""
        if self.scoring is None:
            raise ValueError("The scoring is invalid; check errors before using it.")
        return self.scoring


def parse_scoring(data: object) -> Scoring:
    """Parse stored scoring, which was validated when it was written."""
    return _SCORING_ADAPTER.validate_python(data)


def validate_scoring(data: object) -> ScoringValidationResult:
    """Validate scoring for writing. Like layouts, stored scoring is never re-validated."""
    try:
        scoring = _SCORING_ADAPTER.validate_python(data)
    except ValidationError as exc:
        errors = []
        for error in exc.errors():
            path: list[str | int] = list(error["loc"])
            # Pydantic puts the kind tag first; the path follows the input instead.
            if path and path[0] in _KINDS:
                path = path[1:]
            errors.append(ErrorDetail(code="schema_invalid", message=error["msg"], path=path))
        return ScoringValidationResult(scoring=None, errors=errors)

    errors = _check_scoring(scoring)
    return ScoringValidationResult(scoring=None if errors else scoring, errors=errors)


def _check_scoring(scoring: Scoring) -> list[ErrorDetail]:
    errors = []
    if scoring.schema_version != LATEST_SCORING_SCHEMA_VERSION:
        errors.append(
            ErrorDetail(
                code="unsupported_schema_version",
                message=f"schema_version must be {LATEST_SCORING_SCHEMA_VERSION}.",
                path=["schema_version"],
            )
        )
    threshold = _pass_threshold_and_maximum(scoring)
    if threshold is not None and threshold[0] > threshold[1]:
        errors.append(
            ErrorDetail(
                code="pass_threshold_too_high",
                message=f"pass_threshold can be at most {threshold[1]}.",
                path=["pass_threshold"],
            )
        )
    return errors


def _pass_threshold_and_maximum(scoring: Scoring) -> tuple[int, int] | None:
    """The pass threshold and the most a set can score, for kinds that have a threshold."""
    if isinstance(scoring, SuccessCountScoring | TimedScoring):
        return scoring.pass_threshold, scoring.attempts_per_set
    if isinstance(scoring, PointsScoring):
        return scoring.pass_threshold, scoring.attempts_per_set * scoring.max_points_per_attempt
    return None


def success_rate(attempts: Sequence[ScoredAttempt]) -> float | None:
    """Successes over non-voided attempts; partial is not a success. None without attempts.

    The one definition of success rate (section 4.4)."""
    counted = [attempt for attempt in attempts if not attempt.is_voided]
    if not counted:
        return None
    return sum(attempt.outcome == "success" for attempt in counted) / len(counted)


def compute_set_progress(scoring: Scoring, attempts: Sequence[ScoredAttempt]) -> SetProgress:
    """Set progress for a drill run, from its attempts in attempt_number order.

    Voided attempts are ignored, so they never shift set numbering. A full set stays the
    current set until the next attempt starts the following one."""
    counted = [attempt for attempt in attempts if not attempt.is_voided]
    rate = success_rate(counted)

    if isinstance(scoring, StreakScoring):
        run = best = 0
        for attempt in counted:
            run = run + 1 if attempt.outcome == "success" else 0
            best = max(best, run)
        complete = best >= scoring.streak_length
        return SetProgress(
            set_number=1,
            attempts_in_set=len(counted),
            successes=sum(a.outcome == "success" for a in counted),
            points=None,
            set_complete=complete,
            set_passed=True if complete else None,
            success_rate=rate,
            current_streak=run,
            best_streak=best,
        )

    per_set = scoring.attempts_per_set
    set_number = max(1, -(-len(counted) // per_set))
    in_set = counted[(set_number - 1) * per_set :]
    complete = len(in_set) == per_set
    successes = sum(a.outcome == "success" for a in in_set)
    points = sum(a.points or 0 for a in in_set) if isinstance(scoring, PointsScoring) else None
    score = points if points is not None else successes
    return SetProgress(
        set_number=set_number,
        attempts_in_set=len(in_set),
        successes=successes,
        points=points,
        set_complete=complete,
        set_passed=score >= scoring.pass_threshold if complete else None,
        success_rate=rate,
        current_streak=None,
        best_streak=None,
    )
