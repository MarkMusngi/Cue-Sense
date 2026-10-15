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
