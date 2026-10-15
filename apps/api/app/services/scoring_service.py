"""Scoring validation (docs/architecture.md section 4.4). Pure functions, no I/O."""

from pydantic import BaseModel, TypeAdapter, ValidationError

from app.core.errors import ErrorDetail
from app.schemas.scoring import PointsScoring, Scoring, SuccessCountScoring, TimedScoring

LATEST_SCORING_SCHEMA_VERSION = 1

_SCORING_ADAPTER = TypeAdapter[Scoring](Scoring)
_KINDS = {"success_count", "streak", "points", "timed"}


class ScoringValidationResult(BaseModel):
    scoring: Scoring | None
    errors: list[ErrorDetail]

    def require_scoring(self) -> Scoring:
        """Return the validated scoring, or raise ValueError if validation failed."""
        if self.scoring is None:
            raise ValueError("The scoring is invalid; check errors before using it.")
        return self.scoring


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
