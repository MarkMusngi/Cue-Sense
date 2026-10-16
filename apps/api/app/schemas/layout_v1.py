"""Pydantic models for layout schema version 1, kept only so stored layouts can be upgraded.

Version 1 is no longer written (ADR 0008). Stored documents are never rewritten, so these
models stay for the upgrade function in app.services.layout_service (ADR 0002) and are
never deleted. They check shape only; the cross-element rules were applied at write time.
"""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.schemas.layout import DiamondUnits, LayoutModel, PocketName, Point, Table


class CueBallV1(LayoutModel):
    id: str
    x: DiamondUnits
    y: DiamondUnits
    ball_in_hand: Literal["none", "anywhere", "behind_head_string"]


class ObjectBallV1(LayoutModel):
    id: str
    number: Annotated[int, Field(ge=1, le=15)] | None = None
    x: DiamondUnits
    y: DiamondUnits


class PocketTargetV1(LayoutModel):
    id: str
    kind: Literal["pocket"]
    pocket: PocketName
    # Absent means any ball.
    ball_id: str | None = None


class ZoneTargetV1(LayoutModel):
    """A circle (x, y centre, radius) or a rect (x, y top-left corner, width, height)."""

    id: str
    kind: Literal["zone"]
    shape: Literal["circle", "rect"]
    x: DiamondUnits
    y: DiamondUnits
    radius: DiamondUnits | None = None
    width: DiamondUnits | None = None
    height: DiamondUnits | None = None
    ball_id: str | None = None
    label: str | None = None

    @model_validator(mode="after")
    def _check_shape_fields(self) -> Self:
        if self.shape == "circle":
            if self.radius is None or self.radius <= 0:
                raise ValueError("A circle zone needs a radius greater than 0.")
            if self.width is not None or self.height is not None:
                raise ValueError("A circle zone takes a radius, not a width or height.")
        else:
            if self.width is None or self.width <= 0 or self.height is None or self.height <= 0:
                raise ValueError("A rect zone needs a width and height greater than 0.")
            if self.radius is not None:
                raise ValueError("A rect zone takes a width and height, not a radius.")
        return self


class ArrowAnnotationV1(LayoutModel):
    id: str
    kind: Literal["arrow"]
    points: list[Point] = Field(min_length=2)
    label: str | None = None


class LineAnnotationV1(LayoutModel):
    id: str
    kind: Literal["line"]
    points: list[Point] = Field(min_length=2)
    label: str | None = None


class TextAnnotationV1(LayoutModel):
    id: str
    kind: Literal["text"]
    x: DiamondUnits
    y: DiamondUnits
    text: str = Field(min_length=1)


TargetV1 = Annotated[PocketTargetV1 | ZoneTargetV1, Field(discriminator="kind")]
AnnotationV1 = Annotated[
    ArrowAnnotationV1 | LineAnnotationV1 | TextAnnotationV1, Field(discriminator="kind")
]


class DrillLayoutV1(LayoutModel):
    schema_version: Literal[1]
    table: Table
    cue_ball: CueBallV1
    object_balls: list[ObjectBallV1] = Field(default_factory=list)
    targets: list[TargetV1] = Field(default_factory=list)
    annotations: list[AnnotationV1] = Field(default_factory=list)
