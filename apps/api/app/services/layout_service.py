"""Layout validation (docs/architecture.md section 4.3). Pure functions, no I/O."""

import math
import re
from collections.abc import Iterator

from pydantic import BaseModel, ValidationError
from pydantic_core import ErrorDetails

from app.schemas.layout import (
    CueBall,
    DrillLayout,
    LayoutError,
    ObjectBall,
    PocketTarget,
    TextAnnotation,
    ZoneTarget,
)

LATEST_LAYOUT_SCHEMA_VERSION = 1
MAX_OBJECT_BALLS = 15
MAX_ANNOTATIONS = 20
POSITION_TOLERANCE = 0.002
BALL_DIAMETER_IN = 2.25
# 9 ft only for now (ADR 0006).
PLAYING_SURFACE_LENGTH_IN = {9: 100.0}

TABLE_LENGTH = 8.0
TABLE_WIDTH = 4.0
HEAD_STRING_X = 2.0
CUE_BALL_ID = "ball_0"

_OBJECT_BALL_ID = re.compile(r"ball_[1-9][0-9]*")
_TARGET_ID = re.compile(r"target_[1-9][0-9]*")
_ANNOTATION_ID = re.compile(r"annotation_[1-9][0-9]*")
_ID_FORMATS = {
    _OBJECT_BALL_ID: "ball_<n>",
    _TARGET_ID: "target_<n>",
    _ANNOTATION_ID: "annotation_<n>",
}

# Absorbs float error so values exactly on a boundary pass (0.09 - 0.002 != 0.088).
_FLOAT_EPSILON = 1e-9

# Lists whose items are discriminated unions; Pydantic adds the tag after the index.
_UNION_LISTS = ("targets", "annotations")

ErrorPath = list[str | int]


class LayoutValidationResult(BaseModel):
    layout: DrillLayout | None
    errors: list[LayoutError]

    @property
    def is_valid(self) -> bool:
        return not self.errors


def ball_radius(size_ft: int) -> float:
    """Ball radius in diamond units: one diamond is an eighth of the playing surface length."""
    diamond_in = PLAYING_SURFACE_LENGTH_IN[size_ft] / 8
    return (BALL_DIAMETER_IN / 2) / diamond_in


def validate_layout(data: object) -> LayoutValidationResult:
    """Validate a layout for writing and return the normalized layout or every error.

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
        *_check_duplicate_numbers(layout),
        *_check_ball_bounds(layout),
        *_check_ball_overlaps(layout),
        *_check_behind_head_string(layout),
        *_check_unknown_references(layout),
        *_check_pocket_cue_ball(layout),
        *_check_positions(layout),
        *_check_annotation_count(layout),
    ]
    return LayoutValidationResult(layout=None if errors else layout, errors=errors)


def _schema_error(error: ErrorDetails) -> LayoutError:
    path: ErrorPath = list(error["loc"])
    # Drop the union tag by position, not by text: a pocket target has a "pocket" field.
    # Missing or unknown kinds stop at the index, so they never reach this branch.
    if len(path) >= 3 and path[0] in _UNION_LISTS and isinstance(path[1], int):
        del path[2]
    return LayoutError(code="schema_invalid", message=error["msg"], path=path)


def _not_below(value: float, minimum: float, tolerance: float = 0.0) -> bool:
    """value >= minimum, allowing the tolerance plus float error."""
    return value >= minimum - tolerance - _FLOAT_EPSILON


def _inside_table(x: float, y: float) -> bool:
    return (
        _not_below(x, 0.0)
        and _not_below(TABLE_LENGTH - x, 0.0)
        and _not_below(y, 0.0)
        and _not_below(TABLE_WIDTH - y, 0.0)
    )


def _balls(layout: DrillLayout) -> list[tuple[ErrorPath, CueBall | ObjectBall]]:
    balls: list[tuple[ErrorPath, CueBall | ObjectBall]] = [(["cue_ball"], layout.cue_ball)]
    balls.extend((["object_balls", i], ball) for i, ball in enumerate(layout.object_balls))
    return balls


def _ids(layout: DrillLayout) -> list[tuple[ErrorPath, str, re.Pattern[str] | None]]:
    """Every element id with its path and required pattern (None means exactly ball_0)."""
    ids: list[tuple[ErrorPath, str, re.Pattern[str] | None]] = [
        (["cue_ball", "id"], layout.cue_ball.id, None)
    ]
    ids.extend(
        (["object_balls", i, "id"], ball.id, _OBJECT_BALL_ID)
        for i, ball in enumerate(layout.object_balls)
    )
    ids.extend(
        (["targets", i, "id"], target.id, _TARGET_ID) for i, target in enumerate(layout.targets)
    )
    ids.extend(
        (["annotations", i, "id"], annotation.id, _ANNOTATION_ID)
        for i, annotation in enumerate(layout.annotations)
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
        valid = element_id == CUE_BALL_ID if pattern is None else pattern.fullmatch(element_id)
        if not valid:
            expected = CUE_BALL_ID if pattern is None else f"{_ID_FORMATS[pattern]} with n >= 1"
            yield LayoutError(
                code="invalid_id",
                message=f"Id '{element_id}' must be {expected}.",
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


def _check_duplicate_numbers(layout: DrillLayout) -> Iterator[LayoutError]:
    seen: set[int] = set()
    for i, ball in enumerate(layout.object_balls):
        if ball.number is None:
            continue
        if ball.number in seen:
            yield LayoutError(
                code="duplicate_ball_number",
                message=f"Ball number {ball.number} is used twice.",
                path=["object_balls", i, "number"],
            )
        seen.add(ball.number)


def _check_ball_bounds(layout: DrillLayout) -> Iterator[LayoutError]:
    radius = ball_radius(layout.table.size_ft)
    for path, ball in _balls(layout):
        inside = (
            _not_below(ball.x - radius, 0.0, POSITION_TOLERANCE)
            and _not_below(TABLE_LENGTH - ball.x - radius, 0.0, POSITION_TOLERANCE)
            and _not_below(ball.y - radius, 0.0, POSITION_TOLERANCE)
            and _not_below(TABLE_WIDTH - ball.y - radius, 0.0, POSITION_TOLERANCE)
        )
        if not inside:
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


def _check_behind_head_string(layout: DrillLayout) -> Iterator[LayoutError]:
    cue_ball = layout.cue_ball
    if cue_ball.ball_in_hand == "behind_head_string" and cue_ball.x > HEAD_STRING_X:
        yield LayoutError(
            code="cue_ball_not_behind_head_string",
            message=f"With ball in hand behind the head string, x must be at most {HEAD_STRING_X}.",
            path=["cue_ball", "x"],
        )


def _check_unknown_references(layout: DrillLayout) -> Iterator[LayoutError]:
    known = {CUE_BALL_ID, *(ball.id for ball in layout.object_balls)}
    for i, target in enumerate(layout.targets):
        if target.ball_id is not None and target.ball_id not in known:
            yield LayoutError(
                code="unknown_ball_reference",
                message=f"Target '{target.id}' references unknown ball '{target.ball_id}'.",
                path=["targets", i, "ball_id"],
            )


def _check_pocket_cue_ball(layout: DrillLayout) -> Iterator[LayoutError]:
    for i, target in enumerate(layout.targets):
        if isinstance(target, PocketTarget) and target.ball_id == CUE_BALL_ID:
            yield LayoutError(
                code="pocket_target_cue_ball",
                message=f"Pocket target '{target.id}' must reference an object ball.",
                path=["targets", i, "ball_id"],
            )


def _zone_inside_table(zone: ZoneTarget) -> bool:
    if zone.shape == "circle":
        # Only the centre must be on the table; the circle itself may extend past the rails.
        return _inside_table(zone.x, zone.y)
    width = zone.width or 0.0
    height = zone.height or 0.0
    return _inside_table(zone.x, zone.y) and _inside_table(zone.x + width, zone.y + height)


def _check_positions(layout: DrillLayout) -> Iterator[LayoutError]:
    for i, target in enumerate(layout.targets):
        if isinstance(target, ZoneTarget) and not _zone_inside_table(target):
            yield LayoutError(
                code="position_out_of_bounds",
                message=f"Zone '{target.id}' is not on the table.",
                path=["targets", i],
            )
    for i, annotation in enumerate(layout.annotations):
        if isinstance(annotation, TextAnnotation):
            inside = _inside_table(annotation.x, annotation.y)
        else:
            inside = all(_inside_table(point.x, point.y) for point in annotation.points)
        if not inside:
            yield LayoutError(
                code="position_out_of_bounds",
                message=f"Annotation '{annotation.id}' is not on the table.",
                path=["annotations", i],
            )


def _check_annotation_count(layout: DrillLayout) -> Iterator[LayoutError]:
    if len(layout.annotations) > MAX_ANNOTATIONS:
        yield LayoutError(
            code="too_many_annotations",
            message=f"A layout has at most {MAX_ANNOTATIONS} annotations.",
            path=["annotations"],
        )
