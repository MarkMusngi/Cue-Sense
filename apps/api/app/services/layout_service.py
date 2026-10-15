"""Layout validation and upgrades (docs/architecture.md section 4.3). Pure functions, no I/O."""

import copy
import math
import re
from collections.abc import Iterator
from typing import Any, Self

from pydantic import BaseModel, ValidationError, model_validator
from pydantic_core import ErrorDetails

from app.schemas.layout import Ball, DrillLayout, LayoutError
from app.schemas.layout_v1 import DrillLayoutV1, PocketTargetV1, ZoneTargetV1

LATEST_LAYOUT_SCHEMA_VERSION = 2
MAX_OBJECT_BALLS = 15
POSITION_TOLERANCE = 0.002
BALL_DIAMETER_IN = 2.25
# 9 ft only for now (ADR 0006).
PLAYING_SURFACE_LENGTH_IN = {9: 100.0}
# The landing zone is always this size, in diamond units. It is not stored (ADR 0008).
LANDING_ZONE_RADIUS = 0.5

TABLE_LENGTH = 8.0
TABLE_WIDTH = 4.0
CUE_BALL_ID = "ball_0"

_CUE_BALL_ID = re.compile(re.escape(CUE_BALL_ID))
_OBJECT_BALL_ID = re.compile(r"ball_[1-9][0-9]*")
# Human-readable form of each id pattern, for error messages.
_ID_FORMATS = {
    _CUE_BALL_ID: CUE_BALL_ID,
    _OBJECT_BALL_ID: "ball_<n> with n >= 1",
}

# Absorbs float error so values exactly on a boundary pass (0.09 - 0.002 != 0.088).
_FLOAT_EPSILON = 1e-9

ErrorPath = list[str | int]


class UnsupportedLayoutVersionError(ValueError):
    """The layout has no schema_version this code knows how to read."""


class LayoutValidationResult(BaseModel):
    """Either a validated layout and no errors, or no layout and at least one error."""

    layout: DrillLayout | None
    errors: list[LayoutError]

    @model_validator(mode="after")
    def _check_consistent(self) -> Self:
        if (self.layout is None) != bool(self.errors):
            raise ValueError("A result has a layout or errors, never both or neither.")
        return self

    @property
    def is_valid(self) -> bool:
        return not self.errors

    def require_layout(self) -> DrillLayout:
        """Return the validated layout, or raise ValueError if validation failed."""
        if self.layout is None:
            raise ValueError("The layout is invalid; check errors before using it.")
        return self.layout


def ball_radius(size_ft: int) -> float:
    """Ball radius in diamond units: one diamond is an eighth of the playing surface length."""
    diamond_in = PLAYING_SURFACE_LENGTH_IN[size_ft] / 8
    return (BALL_DIAMETER_IN / 2) / diamond_in


def validate_layout(data: object) -> LayoutValidationResult:
    """Validate a layout for writing and return the normalized layout or its errors.

    If the shape is invalid, only schema_invalid errors are returned, because the other
    rules need a well-formed layout. Otherwise every rule runs and all errors are returned.

    Writes only: per ADR 0002, stored layouts are never re-validated against newer rules.
    Errors come in contract order: rules in the order below, elements in input order.
    """
    try:
        layout = DrillLayout.model_validate(data)
    except ValidationError as exc:
        return LayoutValidationResult(
            layout=None, errors=[_schema_error(error) for error in exc.errors()]
        )

    errors = [
        *_check_schema_version(layout),
        *_check_id_formats(layout),
        *_check_duplicate_ids(layout),
        *_check_object_ball_count(layout),
        *_check_ball_bounds(layout),
        *_check_ball_overlaps(layout),
        *_check_landing_zone(layout),
    ]
    return LayoutValidationResult(layout=None if errors else layout, errors=errors)


def _schema_error(error: ErrorDetails) -> LayoutError:
    return LayoutError(code="schema_invalid", message=error["msg"], path=list(error["loc"]))


def _not_below(value: float, minimum: float, tolerance: float = 0.0) -> bool:
    """value >= minimum, allowing the tolerance plus float error."""
    return value >= minimum - tolerance - _FLOAT_EPSILON


def _inside_table(x: float, y: float, margin: float = 0.0, tolerance: float = 0.0) -> bool:
    """(x, y) is at least margin from every rail, allowing the tolerance."""
    return (
        _not_below(x - margin, 0.0, tolerance)
        and _not_below(TABLE_LENGTH - x - margin, 0.0, tolerance)
        and _not_below(y - margin, 0.0, tolerance)
        and _not_below(TABLE_WIDTH - y - margin, 0.0, tolerance)
    )


def _balls(layout: DrillLayout) -> list[tuple[ErrorPath, Ball]]:
    balls: list[tuple[ErrorPath, Ball]] = [(["cue_ball"], layout.cue_ball)]
    balls.extend((["object_balls", i], ball) for i, ball in enumerate(layout.object_balls))
    return balls


def _ids(layout: DrillLayout) -> list[tuple[ErrorPath, str, re.Pattern[str]]]:
    """Every element id with its path and required pattern."""
    ids: list[tuple[ErrorPath, str, re.Pattern[str]]] = [
        (["cue_ball", "id"], layout.cue_ball.id, _CUE_BALL_ID)
    ]
    ids.extend(
        (["object_balls", i, "id"], ball.id, _OBJECT_BALL_ID)
        for i, ball in enumerate(layout.object_balls)
    )
    return ids


def _check_schema_version(layout: DrillLayout) -> Iterator[LayoutError]:
    if layout.schema_version != LATEST_LAYOUT_SCHEMA_VERSION:
        yield LayoutError(
            code="unsupported_schema_version",
            message=f"schema_version must be {LATEST_LAYOUT_SCHEMA_VERSION}.",
            path=["schema_version"],
        )


def _check_id_formats(layout: DrillLayout) -> Iterator[LayoutError]:
    for path, element_id, pattern in _ids(layout):
        if not pattern.fullmatch(element_id):
            yield LayoutError(
                code="invalid_id",
                message=f"Id '{element_id}' must be {_ID_FORMATS[pattern]}.",
                path=path,
            )


def _check_duplicate_ids(layout: DrillLayout) -> Iterator[LayoutError]:
    seen: set[str] = set()
    for path, element_id, _ in _ids(layout):
        if element_id in seen:
            yield LayoutError(
                code="duplicate_id", message=f"Id '{element_id}' is used twice.", path=path
            )
        seen.add(element_id)


def _check_object_ball_count(layout: DrillLayout) -> Iterator[LayoutError]:
    if len(layout.object_balls) > MAX_OBJECT_BALLS:
        yield LayoutError(
            code="too_many_object_balls",
            message=f"A layout has at most {MAX_OBJECT_BALLS} object balls.",
            path=["object_balls"],
        )


def _check_ball_bounds(layout: DrillLayout) -> Iterator[LayoutError]:
    radius = ball_radius(layout.table.size_ft)
    for path, ball in _balls(layout):
        if not _inside_table(ball.x, ball.y, margin=radius, tolerance=POSITION_TOLERANCE):
            yield LayoutError(
                code="ball_out_of_bounds",
                message=f"Ball '{ball.id}' is not fully inside the cushions.",
                path=path,
            )


def _check_ball_overlaps(layout: DrillLayout) -> Iterator[LayoutError]:
    radius = ball_radius(layout.table.size_ft)
    balls = _balls(layout)
    for i, (_, first) in enumerate(balls):
        for later_path, later in balls[i + 1 :]:
            distance = math.hypot(later.x - first.x, later.y - first.y)
            if not _not_below(distance, 2 * radius, POSITION_TOLERANCE):
                yield LayoutError(
                    code="balls_overlap",
                    message=f"Balls '{first.id}' and '{later.id}' overlap.",
                    path=later_path,
                )


def _check_landing_zone(layout: DrillLayout) -> Iterator[LayoutError]:
    zone = layout.landing_zone
    # Only the centre must be on the table; the circle itself may extend past the rails.
    if zone is not None and not _inside_table(zone.x, zone.y):
        yield LayoutError(
            code="position_out_of_bounds",
            message="The landing zone is not on the table.",
            path=["landing_zone"],
        )


def upgrade_layout(data: object) -> dict[str, Any]:
    """Return a stored layout as the latest schema version, without touching the original.

    Stored documents are never rewritten or re-validated against newer rules (ADR 0002),
    so this runs on every read. Version 2 comes back as a copy. Version 1 is mapped to
    version 2, and the mapping is lossy (ADR 0008): ball_in_hand, ball numbers, labels, all
    annotations and every target but the first pocket and the first zone are dropped.
    Raises UnsupportedLayoutVersionError for any other schema_version, and ValueError if a
    version 1 document is malformed.
    """
    version = data.get("schema_version") if isinstance(data, dict) else None
    if type(version) is int and version == LATEST_LAYOUT_SCHEMA_VERSION:
        return copy.deepcopy(data)  # type: ignore[arg-type]
    if type(version) is int and version == 1:
        return _upgrade_v1(DrillLayoutV1.model_validate(data))
    raise UnsupportedLayoutVersionError(f"Cannot read layout schema_version {version!r}.")


def _upgrade_v1(old: DrillLayoutV1) -> dict[str, Any]:
    upgraded: dict[str, Any] = {
        "schema_version": LATEST_LAYOUT_SCHEMA_VERSION,
        "table": old.table.model_dump(mode="json"),
        "cue_ball": _ball(old.cue_ball),
        "object_balls": [_ball(ball) for ball in old.object_balls],
    }
    zone = next((t for t in old.targets if isinstance(t, ZoneTargetV1)), None)
    if zone is not None:
        upgraded["landing_zone"] = _zone_centre(zone)
    pocket = next((t for t in old.targets if isinstance(t, PocketTargetV1)), None)
    if pocket is not None:
        upgraded["target_pocket"] = pocket.pocket
    return upgraded


def _ball(ball: Any) -> dict[str, Any]:
    return {"id": ball.id, "x": ball.x, "y": ball.y}


def _zone_centre(zone: ZoneTargetV1) -> dict[str, float]:
    if zone.shape == "circle":
        return {"x": zone.x, "y": zone.y}
    width = zone.width or 0.0
    height = zone.height or 0.0
    return {"x": round(zone.x + width / 2, 3), "y": round(zone.y + height / 2, 3)}
