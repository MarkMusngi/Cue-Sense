"""Pydantic models for the scoring JSON (docs/architecture.md section 4.4)."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

PositiveInt = Annotated[int, Field(ge=1)]


class ScoringModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    schema_version: int


class SuccessCountScoring(ScoringModel):
    kind: Literal["success_count"]
    attempts_per_set: PositiveInt
    pass_threshold: PositiveInt


class StreakScoring(ScoringModel):
    kind: Literal["streak"]
    streak_length: PositiveInt


class PointsScoring(ScoringModel):
    kind: Literal["points"]
    attempts_per_set: PositiveInt
    max_points_per_attempt: PositiveInt
    # Total points per set.
    pass_threshold: PositiveInt


class TimedScoring(ScoringModel):
    kind: Literal["timed"]
    attempts_per_set: PositiveInt
    time_limit_seconds: PositiveInt
    pass_threshold: PositiveInt


Scoring = Annotated[
    SuccessCountScoring | StreakScoring | PointsScoring | TimedScoring,
    Field(discriminator="kind"),
]


class ScoredAttempt(BaseModel):
    """The part of an attempt that set progress needs."""

    outcome: Literal["success", "fail", "partial"]
    points: int | None = None
    is_voided: bool = False


class SetProgress(BaseModel):
    """Where a drill run stands in its current set (docs/architecture.md section 4.4).

    For streak scoring the whole run is one set. set_passed is None until the set is
    complete. points is None unless the scoring is points; the streaks are None unless
    it is streak."""

    set_number: int
    attempts_in_set: int
    successes: int
    points: int | None
    set_complete: bool
    set_passed: bool | None
    # Successes over all non-voided attempts in the run; None before the first attempt.
    success_rate: float | None
    current_streak: int | None
    best_streak: int | None
