import uuid
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.practice_session import Notes
from app.schemas.scoring import SetProgress

Outcome = Literal["success", "fail", "partial"]
NonNegativeInt = Annotated[int, Field(ge=0, le=2_000_000_000)]


class AttemptCreate(BaseModel):
    """What a scoring kind needs: success_count and streak send outcome, points sends
    points (the server derives the outcome and ignores any outcome sent), timed sends
    outcome and duration_ms."""

    model_config = ConfigDict(extra="forbid")

    outcome: Outcome | None = None
    points: NonNegativeInt | None = None
    duration_ms: NonNegativeInt | None = None
    # The client's time of the tap; defaults to the time of receipt.
    tapped_at: AwareDatetime | None = None
    notes: Notes | None = None


class AttemptUpdate(BaseModel):
    """Only the fields sent change. voided_at undoes the attempt, and null restores it.
    outcome, points and duration_ms correct the attempt and cannot be cleared."""

    model_config = ConfigDict(extra="forbid")

    outcome: Outcome | None = None
    points: NonNegativeInt | None = None
    duration_ms: NonNegativeInt | None = None
    voided_at: AwareDatetime | None = None
    notes: Notes | None = None


class AttemptSummary(BaseModel):
    """An attempt in a drill run's list. No set_progress: that belongs to the run, and
    computing it once per attempt would repeat the same work."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_number: int
    outcome: Outcome
    points: int | None
    duration_ms: int | None
    tapped_at: AwareDatetime
    recorded_at: AwareDatetime
    voided_at: AwareDatetime | None
    notes: str | None


class AttemptRead(BaseModel):
    id: uuid.UUID
    drill_run_id: uuid.UUID
    attempt_number: int
    outcome: Outcome
    points: int | None
    duration_ms: int | None
    tapped_at: AwareDatetime
    recorded_at: AwareDatetime
    voided_at: AwareDatetime | None
    notes: str | None
    set_progress: SetProgress
