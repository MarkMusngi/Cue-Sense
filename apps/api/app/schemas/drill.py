import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.common import Pagination
from app.schemas.tag import TagRead

DrillStatus = Literal["draft", "active", "archived"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Difficulty = Annotated[int, Field(ge=1, le=5)]
Instructions = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)
]
Description = Annotated[str, StringConstraints(max_length=2_000)]
TagIds = Annotated[list[uuid.UUID], Field(max_length=50)]
SearchText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]

_CONTENT_FIELDS = ("title", "difficulty", "instructions", "layout", "scoring")


class DrillContent(BaseModel):
    """Everything a drill save carries. layout and scoring are checked by their services."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description | None = None
    difficulty: Difficulty
    tag_ids: TagIds = Field(default_factory=list)
    instructions: Instructions
    layout: dict[str, Any]
    scoring: dict[str, Any]


class DrillCreate(BaseModel):
    """Either a new drill's content, or source_drill_id alone to duplicate a drill."""

    model_config = ConfigDict(extra="forbid")

    source_drill_id: uuid.UUID | None = None
    title: Title | None = None
    description: Description | None = None
    difficulty: Difficulty | None = None
    tag_ids: TagIds | None = None
    instructions: Instructions | None = None
    layout: dict[str, Any] | None = None
    scoring: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _create_or_duplicate(self) -> Self:
        if self.source_drill_id is not None:
            extra = sorted(self.model_fields_set - {"source_drill_id"})
            if extra:
                raise ValueError(
                    f"Send source_drill_id alone to duplicate a drill; remove {', '.join(extra)}."
                )
        else:
            missing = [name for name in _CONTENT_FIELDS if getattr(self, name) is None]
            if missing:
                raise ValueError(f"Missing required fields: {', '.join(missing)}.")
        return self

    def content(self) -> DrillContent:
        return DrillContent.model_validate(
            self.model_dump(exclude={"source_drill_id"}, exclude_none=True)
        )


class DrillUpdate(DrillContent):
    # The version the client edited; a different current version means 409.
    base_drill_version_id: uuid.UUID


class DrillStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: DrillStatus


class DrillFilters(Pagination):
    tag_id: uuid.UUID | None = None
    difficulty: Difficulty | None = None
    status: DrillStatus | None = None
    # Case-insensitive match on title or description.
    search: SearchText | None = None


class DrillVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version_number: int
    instructions: str
    layout: dict[str, Any]
    scoring: dict[str, Any]
    created_at: datetime


class DrillRead(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    description: str | None
    difficulty: int
    status: DrillStatus
    source_drill_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead]
    current_version: DrillVersionRead | None
