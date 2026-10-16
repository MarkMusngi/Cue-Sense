import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.services import layout_service
from app.services.layout_service import (
    LANDING_ZONE_RADIUS,
    LayoutValidationResult,
    ball_radius,
    validate_layout,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"

Layout = dict[str, Any]
Path_ = list[str | int]


def base_layout() -> Layout:
    """A fresh copy of the schema version 2 fixture."""
    data: Layout = json.loads((FIXTURES / "layout_v2.json").read_text())
    return data


def error_pairs(result: LayoutValidationResult) -> list[tuple[str, Path_]]:
    return [(error.code, error.path) for error in result.errors]


def assert_valid(data: Layout) -> LayoutValidationResult:
    result = validate_layout(data)
    assert result.errors == []
    assert result.is_valid
    assert result.layout is not None
    return result


def assert_error(data: Layout, code: str, path: Path_) -> LayoutValidationResult:
    result = validate_layout(data)
    assert (code, path) in error_pairs(result)
    assert not result.is_valid
    assert result.layout is None
    return result


def ball(ball_id: str, x: float, y: float, **extra: Any) -> dict[str, Any]:
    return {"id": ball_id, "x": x, "y": y, **extra}


# Fixture, rounding and radius


def test_fixture_layout_is_valid_and_round_trips() -> None:
    data = base_layout()

    result = assert_valid(data)

    assert result.layout is not None
    assert result.layout.model_dump(mode="json", exclude_none=True) == data


def test_optional_fields_can_all_be_left_out() -> None:
    data = base_layout()
    for key in ("landing_zone", "cue_spin", "target_pocket"):
        del data[key]

    result = assert_valid(data)

    assert result.layout is not None
    assert result.layout.model_dump(mode="json", exclude_none=True) == data


def test_coordinates_are_rounded_to_three_decimals() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 2.00049
    data["landing_zone"]["x"] = 3.00051
    data["cue_spin"]["y"] = -0.40049

    result = assert_valid(data)

    assert result.layout is not None
    assert result.layout.cue_ball.x == 2.0
    assert result.layout.landing_zone is not None
    assert result.layout.landing_zone.x == 3.001
    assert result.layout.cue_spin is not None
    assert result.layout.cue_spin.y == -0.4


def test_whole_number_coordinates_are_accepted() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 1
    data["object_balls"][0]["x"] = 4

    assert_valid(data)


def test_ball_radius_on_a_nine_foot_table() -> None:
    assert ball_radius(9) == pytest.approx(0.09)


def test_landing_zone_radius_is_a_fixed_constant() -> None:
    assert LANDING_ZONE_RADIUS == 0.5


# Table size (ADR 0006)


@pytest.mark.parametrize("size_ft", [7, 8, 10])
def test_table_sizes_other_than_nine_feet_are_rejected(size_ft: int) -> None:
    data = base_layout()
    data["table"]["size_ft"] = size_ft

    assert_error(data, "schema_invalid", ["table", "size_ft"])


def test_table_kind_other_than_pool_is_rejected() -> None:
    data = base_layout()
    data["table"]["kind"] = "snooker"

    assert_error(data, "schema_invalid", ["table", "kind"])


def test_radius_is_derived_not_hardcoded(monkeypatch: pytest.MonkeyPatch) -> None:
    near_rail = base_layout()
    near_rail["object_balls"][0]["x"] = 0.1
    close_pair = base_layout()
    close_pair["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_2", 4.3, 2.0)]

    assert_valid(near_rail)
    assert_valid(close_pair)

    monkeypatch.setattr(layout_service, "ball_radius", lambda size_ft: 0.2)

    assert_error(near_rail, "ball_out_of_bounds", ["object_balls", 0])
    assert_error(close_pair, "balls_overlap", ["object_balls", 1])


# Cushions


@pytest.mark.parametrize(
    ("axis", "value"),
    [
        # Frozen to each cushion.
        ("x", 0.09),
        ("x", 7.91),
        ("y", 0.09),
        ("y", 3.91),
        # Past the cushion but within the 0.002 tolerance.
        ("x", 0.088),
        ("x", 7.912),
        ("y", 0.088),
        ("y", 3.912),
    ],
)
def test_ball_touching_a_cushion_passes(axis: str, value: float) -> None:
    data = base_layout()
    data["object_balls"][0][axis] = value

    assert_valid(data)


@pytest.mark.parametrize(
    ("axis", "value"), [("x", 0.087), ("x", 7.913), ("y", 0.087), ("y", 3.913)]
)
def test_ball_past_the_cushion_tolerance_fails(axis: str, value: float) -> None:
    data = base_layout()
    data["object_balls"][0][axis] = value

    assert_error(data, "ball_out_of_bounds", ["object_balls", 0])


def test_cue_ball_out_of_bounds_points_at_the_cue_ball() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 0.05

    assert_error(data, "ball_out_of_bounds", ["cue_ball"])


# Balls touching and overlapping


@pytest.mark.parametrize(("second_x", "second_y"), [(4.18, 2.0), (4.0, 2.18), (4.178, 2.0)])
def test_touching_balls_pass(second_x: float, second_y: float) -> None:
    data = base_layout()
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_2", second_x, second_y)]

    assert_valid(data)


def test_balls_overlapping_past_the_tolerance_fail() -> None:
    data = base_layout()
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_2", 4.177, 2.0)]

    assert_error(data, "balls_overlap", ["object_balls", 1])


def test_cue_ball_overlapping_an_object_ball_fails() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 5.4
    data["cue_ball"]["y"] = 1.2

    assert_error(data, "balls_overlap", ["object_balls", 0])


# Balls, ids and counts


def test_missing_cue_ball_is_a_schema_error() -> None:
    data = base_layout()
    del data["cue_ball"]

    assert_error(data, "schema_invalid", ["cue_ball"])


def test_cue_ball_id_must_be_ball_0() -> None:
    data = base_layout()
    data["cue_ball"]["id"] = "ball_1"

    assert_error(data, "invalid_id", ["cue_ball", "id"])


@pytest.mark.parametrize("missing", [False, True])
def test_empty_object_balls_pass(missing: bool) -> None:
    data = base_layout()
    if missing:
        del data["object_balls"]
    else:
        data["object_balls"] = []

    assert_valid(data)


def _row_of_balls(count: int) -> list[dict[str, Any]]:
    return [
        ball(f"ball_{n}", 0.4 + 0.45 * ((n - 1) % 16), 0.5 + 0.5 * ((n - 1) // 16))
        for n in range(1, count + 1)
    ]


def test_fifteen_object_balls_pass() -> None:
    data = base_layout()
    data["object_balls"] = _row_of_balls(15)
    data["cue_ball"]["y"] = 3.5

    assert_valid(data)


def test_sixteen_object_balls_fail() -> None:
    data = base_layout()
    data["object_balls"] = _row_of_balls(16)
    data["cue_ball"]["y"] = 3.5

    assert_error(data, "too_many_object_balls", ["object_balls"])


@pytest.mark.parametrize("bad_id", ["ball_0", "ball_01", "ball_x", "Ball_1", "b1", ""])
def test_invalid_object_ball_ids_fail(bad_id: str) -> None:
    data = base_layout()
    data["object_balls"][0]["id"] = bad_id

    assert_error(data, "invalid_id", ["object_balls", 0, "id"])


def test_duplicate_ids_fail_on_the_later_occurrence() -> None:
    data = base_layout()
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_1", 5.0, 2.0)]

    assert_error(data, "duplicate_id", ["object_balls", 1, "id"])


# What v2 no longer has


@pytest.mark.parametrize(
    ("path", "key", "value"),
    [
        (["cue_ball"], "ball_in_hand", "none"),
        (["object_balls", 0], "number", 1),
        ([], "targets", []),
        ([], "annotations", []),
    ],
)
def test_fields_from_schema_v1_are_rejected(path: Path_, key: str, value: Any) -> None:
    data = base_layout()
    target: Any = data
    for step in path:
        target = target[step]
    target[key] = value

    assert_error(data, "schema_invalid", [*path, key])


# Landing zone


@pytest.mark.parametrize(("x", "y"), [(0.0, 0.0), (8.0, 4.0), (0.0, 4.0), (8.0, 0.0)])
def test_landing_zone_centred_exactly_on_the_table_edge_passes(x: float, y: float) -> None:
    data = base_layout()
    data["landing_zone"] = {"x": x, "y": y}

    assert_valid(data)


@pytest.mark.parametrize(("x", "y"), [(-0.001, 2.0), (8.001, 2.0), (4.0, -0.001), (4.0, 4.001)])
def test_landing_zone_centre_off_the_table_fails(x: float, y: float) -> None:
    data = base_layout()
    data["landing_zone"] = {"x": x, "y": y}

    assert_error(data, "position_out_of_bounds", ["landing_zone"])


def test_landing_zone_takes_a_single_position_not_a_list() -> None:
    data = base_layout()
    data["landing_zone"] = [{"x": 3.0, "y": 2.0}, {"x": 4.0, "y": 2.0}]

    assert_error(data, "schema_invalid", ["landing_zone"])


def test_landing_zone_has_no_stored_size() -> None:
    data = base_layout()
    data["landing_zone"]["radius"] = 0.8

    assert_error(data, "schema_invalid", ["landing_zone", "radius"])


def test_landing_zone_may_sit_under_a_ball() -> None:
    data = base_layout()
    data["landing_zone"] = {"x": 5.5, "y": 1.2}

    assert_valid(data)


# Cue spin


@pytest.mark.parametrize(
    ("x", "y"), [(0.0, 0.0), (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0), (0.707, 0.707)]
)
def test_cue_spin_inside_or_on_the_unit_disc_passes(x: float, y: float) -> None:
    data = base_layout()
    data["cue_spin"] = {"x": x, "y": y}

    assert_valid(data)


@pytest.mark.parametrize(("x", "y"), [(0.8, 0.8), (1.001, 0.0), (0.0, -1.001), (-0.75, 0.75)])
def test_cue_spin_outside_the_unit_disc_fails(x: float, y: float) -> None:
    data = base_layout()
    data["cue_spin"] = {"x": x, "y": y}

    assert_error(data, "schema_invalid", ["cue_spin"])


def test_cue_spin_needs_both_offsets() -> None:
    data = base_layout()
    data["cue_spin"] = {"x": 0.2}

    assert_error(data, "schema_invalid", ["cue_spin", "y"])


# Target pocket


@pytest.mark.parametrize(
    "pocket",
    ["top_left", "top_middle", "top_right", "bottom_left", "bottom_middle", "bottom_right"],
)
def test_every_pocket_name_is_accepted(pocket: str) -> None:
    data = base_layout()
    data["target_pocket"] = pocket

    assert_valid(data)


@pytest.mark.parametrize("pocket", ["middle", "TOP_LEFT", "", 3])
def test_unknown_pocket_names_fail(pocket: object) -> None:
    data = base_layout()
    data["target_pocket"] = pocket

    assert_error(data, "schema_invalid", ["target_pocket"])


# Schema version


def test_missing_schema_version_is_a_schema_error() -> None:
    data = base_layout()
    del data["schema_version"]

    assert_error(data, "schema_invalid", ["schema_version"])


@pytest.mark.parametrize("schema_version", [0, 1, 3])
def test_schema_version_other_than_latest_fails(schema_version: int) -> None:
    data = base_layout()
    data["schema_version"] = schema_version

    assert_error(data, "unsupported_schema_version", ["schema_version"])


# Schema errors


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(unknown=1) or ["unknown"],
        lambda d: d["cue_ball"].update(x="2") or ["cue_ball", "x"],
        lambda d: d["cue_ball"].update(x=float("nan")) or ["cue_ball", "x"],
        lambda d: d["object_balls"][0].update(y=None) or ["object_balls", 0, "y"],
        lambda d: d["landing_zone"].update(x=True) or ["landing_zone", "x"],
        lambda d: d.update(object_balls="none") or ["object_balls"],
    ],
)
def test_bad_input_values_are_schema_errors(mutate: Callable[[Layout], Path_]) -> None:
    data = base_layout()
    path = mutate(data)

    assert_error(data, "schema_invalid", path)


@pytest.mark.parametrize("data", [None, [], "layout", 3])
def test_non_object_input_is_a_schema_error(data: object) -> None:
    result = validate_layout(data)

    assert [error.code for error in result.errors] == ["schema_invalid"]
    assert result.layout is None


# Error order and result contract


def test_schema_errors_are_returned_alone() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = "2"
    data["object_balls"][0]["x"] = 0.0

    assert [code for code, _ in error_pairs(validate_layout(data))] == ["schema_invalid"]


def test_several_problems_are_all_returned_in_contract_order() -> None:
    data = base_layout()
    data["schema_version"] = 3
    data["cue_ball"]["id"] = "ball_9"
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_1", 4.1, 2.0)]
    data["landing_zone"] = {"x": 9.0, "y": 2.0}

    assert error_pairs(validate_layout(data)) == [
        ("unsupported_schema_version", ["schema_version"]),
        ("invalid_id", ["cue_ball", "id"]),
        ("duplicate_id", ["object_balls", 1, "id"]),
        ("balls_overlap", ["object_balls", 1]),
        ("position_out_of_bounds", ["landing_zone"]),
    ]


def test_require_layout_returns_the_valid_layout() -> None:
    result = assert_valid(base_layout())

    assert result.require_layout() is result.layout


def test_require_layout_raises_when_invalid() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 0.0

    with pytest.raises(ValueError, match="invalid"):
        validate_layout(data).require_layout()


def test_result_cannot_have_both_or_neither_layout_and_errors() -> None:
    valid = assert_valid(base_layout())
    invalid_data = base_layout()
    invalid_data["cue_ball"]["x"] = 0.0
    invalid = validate_layout(invalid_data)

    with pytest.raises(ValidationError):
        LayoutValidationResult(layout=valid.layout, errors=invalid.errors)
    with pytest.raises(ValidationError):
        LayoutValidationResult(layout=None, errors=[])


def test_validated_layout_is_frozen() -> None:
    layout = assert_valid(base_layout()).require_layout()

    with pytest.raises(ValidationError):
        layout.cue_ball.x = 3.0  # type: ignore[misc]


def test_input_is_not_mutated() -> None:
    data = base_layout()
    before = copy.deepcopy(data)

    validate_layout(data)

    assert data == before
