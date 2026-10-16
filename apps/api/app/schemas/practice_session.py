import uuid
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, StringConstraints

from app.schemas.scoring import SetProgress

Location = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Notes = Annotated[str, StringConstraints(max_length=5_000)]


class PracticeSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: Location | None = None
    notes: Notes | None = None


class PracticeSessionUpdate(BaseModel):
    """Only the fields sent change. ended_at finishes the session and cannot be undone;
    location and notes can be cleared with null."""

    model_config = ConfigDict(extra="forbid")

    ended_at: AwareDatetime | None = None
    location: Location | None = None
    notes: Notes | None = None


class DrillRunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    drill_id: uuid.UUID


class DrillRunUpdate(BaseModel):
    """ended_at ends the drill run and cannot be undone; notes can be cleared with null."""

    model_config = ConfigDict(extra="forbid")

    ended_at: AwareDatetime | None = None
    notes: Notes | None = None


class DrillRunRead(BaseModel):
    id: uuid.UUID
    practice_session_id: uuid.UUID
    drill_id: uuid.UUID
    drill_version_id: uuid.UUID
    run_number: int
    started_at: AwareDatetime
    ended_at: AwareDatetime | None
    notes: str | None
    # Server-derived, so the client can reconcile any optimistic count.
    set_progress: SetProgress


class PracticeSessionRead(BaseModel):
    id: uuid.UUID
    started_at: AwareDatetime
    ended_at: AwareDatetime | None
    location: str | None
    notes: str | None


class PracticeSessionDetail(PracticeSessionRead):
    drill_runs: list[DrillRunRead]
