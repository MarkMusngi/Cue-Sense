import copy
import json
import math
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.services import layout_service
from app.services.layout_service import LayoutValidationResult, ball_radius, validate_layout

FIXTURES = Path(__file__).resolve().parent / "fixtures"

Layout = dict[str, Any]
Path_ = list[str | int]


def base_layout() -> Layout:
    """A fresh copy of the schema version 1 fixture from architecture section 4.3."""
    data: Layout = json.loads((FIXTURES / "layout_v1.json").read_text())
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


def text_annotation(n: int, x: float = 1.0, y: float = 0.5) -> dict[str, Any]:
    return {"id": f"annotation_{n}", "kind": "text", "x": x, "y": y, "text": "Note"}


# Fixture, rounding and radius


def test_fixture_layout_is_valid_and_round_trips() -> None:
    data = base_layout()

    result = assert_valid(data)

    assert result.layout is not None
    assert result.layout.model_dump(mode="json", exclude_none=True) == data


def test_coordinates_are_rounded_to_three_decimals() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 2.00049

    result = assert_valid(data)

    assert result.layout is not None
    assert result.layout.cue_ball.x == 2.0


def test_whole_number_coordinates_are_accepted() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 1
    data["object_balls"][0]["x"] = 4

    assert_valid(data)


def test_ball_radius_on_a_nine_foot_table() -> None:
    assert ball_radius(9) == pytest.approx(0.09)


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
    ("axis", "value"),
    [("x", 0.087), ("x", 7.913), ("y", 0.087), ("y", 3.913)],
)
def test_ball_past_the_cushion_tolerance_fails(axis: str, value: float) -> None:
    data = base_layout()
    data["object_balls"][0][axis] = value

    assert_error(data, "ball_out_of_bounds", ["object_balls", 0])


def test_cue_ball_out_of_bounds_points_at_the_cue_ball() -> None:
    data = base_layout()
    data["cue_ball"]["y"] = 3.95

    assert_error(data, "ball_out_of_bounds", ["cue_ball"])


# Ball overlap


@pytest.mark.parametrize(
    ("second_x", "second_y"),
    [
        (4.18, 2.0),  # exactly touching
        (4.108, 2.144),  # exactly touching on a 3-4-5 diagonal
        (4.178, 2.0),  # overlapping by the tolerance
    ],
)
def test_touching_balls_pass(second_x: float, second_y: float) -> None:
    data = base_layout()
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_2", second_x, second_y)]

    assert_valid(data)


def test_balls_overlapping_past_the_tolerance_fail() -> None:
    data = base_layout()
    data["object_balls"] = [ball("ball_1", 4.0, 2.0), ball("ball_2", 4.177, 2.0)]

    result = assert_error(data, "balls_overlap", ["object_balls", 1])

    message = result.errors[0].message
    assert "ball_1" in message and "ball_2" in message


def test_cue_ball_overlapping_an_object_ball_fails() -> None:
    data = base_layout()
    data["object_balls"][0]["x"] = 2.1
    data["object_balls"][0]["y"] = 2.0

    assert_error(data, "balls_overlap", ["object_balls", 0])


# Cue ball and object balls


def test_missing_cue_ball_is_a_schema_error() -> None:
    data = base_layout()
    del data["cue_ball"]

    assert_error(data, "schema_invalid", ["cue_ball"])


def test_cue_ball_id_must_be_ball_0() -> None:
    data = base_layout()
    data["cue_ball"]["id"] = "ball_3"

    assert_error(data, "invalid_id", ["cue_ball", "id"])


@pytest.mark.parametrize("missing", [False, True])
def test_empty_collections_pass(missing: bool) -> None:
    data = base_layout()
    for key in ("object_balls", "targets", "annotations"):
        if missing:
            del data[key]
        else:
            data[key] = []

    assert_valid(data)


def _ball_grid(count: int) -> list[dict[str, Any]]:
    return [ball(f"ball_{i + 1}", 3.0 + (i % 8) * 0.5, 1.0 + (i // 8) * 1.0) for i in range(count)]


def test_fifteen_object_balls_pass() -> None:
    data = base_layout()
    data["object_balls"] = _ball_grid(15)

    assert_valid(data)


def test_sixteen_object_balls_fail() -> None:
    data = base_layout()
    data["object_balls"] = _ball_grid(16)

    assert_error(data, "too_many_object_balls", ["object_balls"])


@pytest.mark.parametrize(
    ("collection", "bad_id"),
    [
        ("object_balls", "ball1"),
        ("object_balls", "ball_01"),
        ("object_balls", "Ball_1"),
        ("object_balls", "ball_0"),
        ("targets", "target_0"),
        ("annotations", "note_1"),
    ],
)
def test_invalid_id_formats_fail(collection: str, bad_id: str) -> None:
    data = base_layout()
    data[collection][0]["id"] = bad_id

    assert_error(data, "invalid_id", [collection, 0, "id"])


def test_duplicate_ids_fail_on_the_later_occurrence() -> None:
    data = base_layout()
    data["object_balls"].append(ball("ball_1", 6.5, 3.0))

    assert_error(data, "duplicate_id", ["object_balls", 1, "id"])


def test_duplicate_ball_numbers_fail_on_the_later_ball() -> None:
    data = base_layout()
    data["object_balls"].append(ball("ball_2", 6.5, 3.0, number=1))

    assert_error(data, "duplicate_ball_number", ["object_balls", 1, "number"])


def test_balls_without_numbers_pass() -> None:
    data = base_layout()
    del data["object_balls"][0]["number"]
    data["object_balls"].append(ball("ball_2", 6.5, 3.0))

    assert_valid(data)


@pytest.mark.parametrize("number", [0, 16])
def test_ball_numbers_outside_one_to_fifteen_fail(number: int) -> None:
    data = base_layout()
    data["object_balls"][0]["number"] = number

    assert_error(data, "schema_invalid", ["object_balls", 0, "number"])


# Ball in hand


def test_behind_head_string_at_the_head_string_passes() -> None:
    data = base_layout()
    data["cue_ball"]["ball_in_hand"] = "behind_head_string"
    data["cue_ball"]["x"] = 2.0

    assert_valid(data)


def test_behind_head_string_past_the_head_string_fails() -> None:
    data = base_layout()
    data["cue_ball"]["ball_in_hand"] = "behind_head_string"
    data["cue_ball"]["x"] = 2.05

    assert_error(data, "cue_ball_not_behind_head_string", ["cue_ball", "x"])


def test_ball_in_hand_anywhere_allows_any_position() -> None:
    data = base_layout()
    data["cue_ball"]["ball_in_hand"] = "anywhere"
    data["cue_ball"]["x"] = 5.0

    assert_valid(data)


# Targets


def test_target_referencing_an_unknown_ball_fails() -> None:
    data = base_layout()
    data["targets"][0]["ball_id"] = "ball_9"

    assert_error(data, "unknown_ball_reference", ["targets", 0, "ball_id"])


def test_pocket_target_referencing_the_cue_ball_fails() -> None:
    data = base_layout()
    data["targets"][0]["ball_id"] = "ball_0"

    assert_error(data, "pocket_target_cue_ball", ["targets", 0, "ball_id"])


def test_zone_target_may_reference_the_cue_ball() -> None:
    data = base_layout()

    assert data["targets"][1]["ball_id"] == "ball_0"
    assert_valid(data)


def test_pocket_target_without_a_ball_passes() -> None:
    data = base_layout()
    del data["targets"][0]["ball_id"]

    assert_valid(data)


def test_rect_zone_spilling_off_the_table_fails() -> None:
    data = base_layout()
    data["targets"][2]["x"] = 7.5
    data["targets"][2]["width"] = 1.0

    assert_error(data, "position_out_of_bounds", ["targets", 2])


def test_circle_zone_centre_off_the_table_fails() -> None:
    data = base_layout()
    data["targets"][1]["y"] = 4.2

    assert_error(data, "position_out_of_bounds", ["targets", 1])


# Schema error paths


def test_pocket_target_missing_its_pocket_points_at_the_pocket_field() -> None:
    data = base_layout()
    del data["targets"][0]["pocket"]

    assert_error(data, "schema_invalid", ["targets", 0, "pocket"])


def test_invalid_pocket_name_points_at_the_pocket_field() -> None:
    data = base_layout()
    data["targets"][0]["pocket"] = "middle_left"

    assert_error(data, "schema_invalid", ["targets", 0, "pocket"])


def _drop_circle_radius(data: Layout) -> None:
    del data["targets"][1]["radius"]


def _add_radius_to_rect(data: Layout) -> None:
    data["targets"][2]["radius"] = 0.5


def _unknown_target_kind(data: Layout) -> None:
    data["targets"][0]["kind"] = "triangle"


@pytest.mark.parametrize(
    ("mutate", "index"),
    [(_drop_circle_radius, 1), (_add_radius_to_rect, 2), (_unknown_target_kind, 0)],
)
def test_bad_targets_point_at_the_target(mutate: Callable[[Layout], None], index: int) -> None:
    data = base_layout()
    mutate(data)

    result = validate_layout(data)

    assert [code for code, _ in error_pairs(result)] == ["schema_invalid"]
    assert result.errors[0].path[:2] == ["targets", index]


# Annotations


def test_twenty_annotations_pass() -> None:
    data = base_layout()
    data["annotations"] = [text_annotation(n) for n in range(1, 21)]

    assert_valid(data)


def test_twenty_one_annotations_fail() -> None:
    data = base_layout()
    data["annotations"] = [text_annotation(n) for n in range(1, 22)]

    assert_error(data, "too_many_annotations", ["annotations"])


def test_arrow_with_one_point_fails() -> None:
    data = base_layout()
    data["annotations"][0]["points"] = [{"x": 2.0, "y": 2.0}]

    assert_error(data, "schema_invalid", ["annotations", 0, "points"])


def test_text_annotation_off_the_table_fails() -> None:
    data = base_layout()
    data["annotations"][2]["x"] = 8.5

    assert_error(data, "position_out_of_bounds", ["annotations", 2])


def test_annotation_point_off_the_table_fails() -> None:
    data = base_layout()
    data["annotations"][1]["points"][1]["y"] = -0.1

    assert_error(data, "position_out_of_bounds", ["annotations", 1])


# Schema version


def test_missing_schema_version_is_a_schema_error() -> None:
    data = base_layout()
    del data["schema_version"]

    assert_error(data, "schema_invalid", ["schema_version"])


@pytest.mark.parametrize("schema_version", [0, 2])
def test_schema_version_other_than_latest_fails(schema_version: int) -> None:
    data = base_layout()
    data["schema_version"] = schema_version

    assert_error(data, "unsupported_schema_version", ["schema_version"])


# Bad input values


def _camel_case_key(data: Layout) -> Path_:
    data["objectBalls"] = data.pop("object_balls")
    return ["objectBalls"]


def _set_cue_x(value: Any) -> Callable[[Layout], Path_]:
    def mutate(data: Layout) -> Path_:
        data["cue_ball"]["x"] = value
        return ["cue_ball", "x"]

    return mutate


@pytest.mark.parametrize(
    "mutate",
    [
        _camel_case_key,
        _set_cue_x("2.0"),
        _set_cue_x(True),
        _set_cue_x(None),
        _set_cue_x(math.nan),
        _set_cue_x(math.inf),
        _set_cue_x(-math.inf),
    ],
    ids=["camel_case_key", "string", "bool", "none", "nan", "inf", "negative_inf"],
)
def test_bad_input_values_are_schema_errors(mutate: Callable[[Layout], Path_]) -> None:
    data = base_layout()
    path = mutate(data)

    assert_error(data, "schema_invalid", path)


def test_non_object_input_is_a_schema_error() -> None:
    result = validate_layout(["not", "a", "layout"])

    assert [code for code, _ in error_pairs(result)] == ["schema_invalid"]


# Contract: all errors, in order, without side effects


def test_several_problems_are_all_returned_in_contract_order() -> None:
    data = base_layout()
    data["schema_version"] = 2
    data["object_balls"] = [
        ball("ball_1", 0.05, 1.2),
        ball("ball_2", 5.5, 1.2),
        ball("ball_3", 5.6, 1.2),
    ]
    data["targets"][0]["ball_id"] = "ball_9"
    data["annotations"][2]["x"] = 8.5

    result = validate_layout(data)

    assert error_pairs(result) == [
        ("unsupported_schema_version", ["schema_version"]),
        ("ball_out_of_bounds", ["object_balls", 0]),
        ("balls_overlap", ["object_balls", 2]),
        ("unknown_ball_reference", ["targets", 0, "ball_id"]),
        ("position_out_of_bounds", ["annotations", 2]),
    ]


def test_input_is_not_mutated() -> None:
    data = base_layout()
    data["cue_ball"]["x"] = 2.00049
    data["object_balls"][0]["x"] = 0.05
    before = copy.deepcopy(data)

    validate_layout(data)

    assert data == before
