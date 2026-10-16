"""Pydantic models for the latest layout JSON, schema version 2 (docs/architecture.md 4.3).

These models check shape, types and single-element values (such as the spin disc). Rules
that span elements (bounds, overlaps, ids) live in app.services.layout_service. Version 1
documents are read through app.schemas.layout_v1 and upgraded (ADR 0002, ADR 0008).
"""

from typing import Annotated, Literal, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


def _round_to_millis(value: float) -> float:
    return round(value, 3)


# Positions in diamond units, rounded to 3 decimals before any rule runs.
DiamondUnits = Annotated[float, AfterValidator(_round_to_millis)]
# Spin offsets are unitless (-1 to 1 across the cue ball face), rounded the same way.
SpinOffset = Annotated[float, AfterValidator(_round_to_millis)]

PocketName = Literal[
    "top_left", "top_middle", "top_right", "bottom_left", "bottom_middle", "bottom_right"
]

# Absorbs float error so a hit point exactly on the rim of the disc passes.
_DISC_EPSILON = 1e-9


LayoutErrorCode = Literal[
    "schema_invalid",
    "unsupported_schema_version",
    "invalid_id",
    "duplicate_id",
    "too_many_object_balls",
    "ball_out_of_bounds",
    "balls_overlap",
    "position_out_of_bounds",
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


class Ball(LayoutModel):
    id: str
    x: DiamondUnits
    y: DiamondUnits


class CueSpin(LayoutModel):
    """Where the cue tip meets the cue ball: x is side (-1 left to 1 right), y is vertical
    (-1 bottom to 1 top). The point must lie on or inside the unit disc."""

    x: SpinOffset
    y: SpinOffset

    @model_validator(mode="after")
    def _check_inside_disc(self) -> Self:
        if self.x * self.x + self.y * self.y > 1 + _DISC_EPSILON:
            raise ValueError("The spin point must lie inside the cue ball face (x² + y² <= 1).")
        return self


class DrillLayout(LayoutModel):
    schema_version: int
    table: Table
    cue_ball: Ball
    object_balls: list[Ball] = Field(default_factory=list)
    # One fixed-size circle centred here; the radius is a constant, not stored (ADR 0008).
    landing_zone: Point | None = None
    cue_spin: CueSpin | None = None
    target_pocket: PocketName | None = None


class LayoutError(BaseModel):
    """One validation failure. path follows the input JSON, for example ["object_balls", 2]."""

    code: LayoutErrorCode
    message: str
    path: list[str | int]
