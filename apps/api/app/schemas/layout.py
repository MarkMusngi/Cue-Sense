"""Pydantic models for the layout JSON (docs/architecture.md section 4.3).

These models check shape, types and single-element values (such as zone sizes). Rules
that span elements (bounds, overlaps, references, ids) live in app.services.layout_service.
"""

from typing import Annotated, Literal, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


def _round_to_millis(value: float) -> float:
    return round(value, 3)


# Positions and sizes in diamond units, rounded to 3 decimals before any rule runs.
DiamondUnits = Annotated[float, AfterValidator(_round_to_millis)]

PocketName = Literal[
    "top_left", "top_middle", "top_right", "bottom_left", "bottom_middle", "bottom_right"
]


LayoutErrorCode = Literal[
    "schema_invalid",
    "unsupported_schema_version",
    "invalid_id",
    "duplicate_id",
    "too_many_object_balls",
    "duplicate_ball_number",
    "ball_out_of_bounds",
    "balls_overlap",
    "cue_ball_not_behind_head_string",
    "unknown_ball_reference",
    "pocket_target_cue_ball",
    "position_out_of_bounds",
    "too_many_annotations",
]


class LayoutModel(BaseModel):
    # Frozen so a validated layout cannot be edited past the cross-element rules.
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, frozen=True)


class Point(LayoutModel):
    x: DiamondUnits
    y: DiamondUnits


class Table(LayoutModel):
    kind: Literal["pool"]
    # 9 ft only for now (ADR 0006). The key stays so other sizes can be added later.
    size_ft: Literal[9]


class CueBall(LayoutModel):
    id: str
    x: DiamondUnits
    y: DiamondUnits
    ball_in_hand: Literal["none", "anywhere", "behind_head_string"]


class ObjectBall(LayoutModel):
    id: str
    number: Annotated[int, Field(ge=1, le=15)] | None = None
    x: DiamondUnits
    y: DiamondUnits


class PocketTarget(LayoutModel):
    id: str
    kind: Literal["pocket"]
    pocket: PocketName
    # Absent means any ball.
    ball_id: str | None = None


class ZoneTarget(LayoutModel):
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


class ArrowAnnotation(LayoutModel):
    id: str
    kind: Literal["arrow"]
    points: list[Point] = Field(min_length=2)
    label: str | None = None


class LineAnnotation(LayoutModel):
    id: str
    kind: Literal["line"]
    points: list[Point] = Field(min_length=2)
    label: str | None = None


class TextAnnotation(LayoutModel):
    id: str
    kind: Literal["text"]
    x: DiamondUnits
    y: DiamondUnits
    text: str = Field(min_length=1)


Target = Annotated[PocketTarget | ZoneTarget, Field(discriminator="kind")]
Annotation = Annotated[
    ArrowAnnotation | LineAnnotation | TextAnnotation, Field(discriminator="kind")
]


class DrillLayout(LayoutModel):
    schema_version: int
    table: Table
    cue_ball: CueBall
    object_balls: list[ObjectBall] = Field(default_factory=list)
    targets: list[Target] = Field(default_factory=list)
    annotations: list[Annotation] = Field(default_factory=list)


class LayoutError(BaseModel):
    """One validation failure. path follows the input JSON, for example ["object_balls", 2]."""

    code: LayoutErrorCode
    message: str
    path: list[str | int]
