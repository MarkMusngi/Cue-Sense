"""Layout schema upgrades on read (ADR 0002, ADR 0008). v1 documents are never rewritten."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from app.services.layout_service import (
    LANDING_ZONE_RADIUS,
    UnsupportedLayoutVersionError,
    upgrade_layout,
    validate_layout,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"

Layout = dict[str, Any]


def v1_fixture() -> Layout:
    data: Layout = json.loads((FIXTURES / "layout_v1.json").read_text())
    return data


def seed_layouts_v1() -> dict[str, Layout]:
    data: dict[str, Layout] = json.loads((FIXTURES / "seed_layouts_v1.json").read_text())
    return data


def minimal_v1(**extra: Any) -> Layout:
    return {
        "schema_version": 1,
        "table": {"kind": "pool", "size_ft": 9},
        "cue_ball": {"id": "ball_0", "x": 2.0, "y": 2.0, "ball_in_hand": "none"},
        **extra,
    }


def circle_zone(n: int, x: float, y: float, **extra: Any) -> Layout:
    return {
        "id": f"target_{n}",
        "kind": "zone",
        "shape": "circle",
        "x": x,
        "y": y,
        "radius": 0.4,
        **extra,
    }


def rect_zone(n: int, x: float, y: float, width: float, height: float) -> Layout:
    return {
        "id": f"target_{n}",
        "kind": "zone",
        "shape": "rect",
        "x": x,
        "y": y,
        "width": width,
        "height": height,
    }


def pocket(n: int, name: str, ball_id: str | None = None) -> Layout:
    target: Layout = {"id": f"target_{n}", "kind": "pocket", "pocket": name}
    if ball_id is not None:
        target["ball_id"] = ball_id
    return target


# The v1 fixture from architecture section 4.3


def test_v1_fixture_upgrades_to_the_expected_v2_layout() -> None:
    assert upgrade_layout(v1_fixture()) == {
        "schema_version": 2,
        "table": {"kind": "pool", "size_ft": 9},
        "cue_ball": {"id": "ball_0", "x": 2.0, "y": 2.0},
        "object_balls": [{"id": "ball_1", "x": 5.5, "y": 1.2}],
        # The first zone, the circle at (3, 2); the rect and every annotation are dropped.
        "landing_zone": {"x": 3.0, "y": 2.0},
        "target_pocket": "top_right",
    }


def test_upgraded_v1_fixture_is_a_valid_v2_layout() -> None:
    upgraded = upgrade_layout(v1_fixture())

    result = validate_layout(upgraded)

    assert result.errors == []
    assert result.require_layout().model_dump(mode="json", exclude_none=True) == upgraded


@pytest.mark.parametrize("slug", sorted(seed_layouts_v1()))
def test_every_seed_drill_layout_upgrades_to_a_valid_v2_layout(slug: str) -> None:
    upgraded = upgrade_layout(seed_layouts_v1()[slug])

    result = validate_layout(upgraded)

    assert result.errors == [], slug
    assert result.require_layout().model_dump(mode="json", exclude_none=True) == upgraded


def test_seed_drills_keep_their_ball_positions_and_pockets() -> None:
    layouts = seed_layouts_v1()

    cut = upgrade_layout(layouts["thirty-degree-cut"])
    run_out = upgrade_layout(layouts["five-ball-run-out"])

    assert cut["cue_ball"] == {"id": "ball_0", "x": 3.941, "y": 2.645}
    assert cut["object_balls"] == [{"id": "ball_1", "x": 6.0, "y": 2.0}]
    assert cut["target_pocket"] == "top_right"
    assert len(run_out["object_balls"]) == len(layouts["five-ball-run-out"]["object_balls"])
    assert "target_pocket" not in run_out
    assert "landing_zone" not in run_out


# What the mapping keeps and drops


def test_ball_in_hand_and_ball_numbers_are_dropped() -> None:
    data = minimal_v1(object_balls=[{"id": "ball_1", "number": 7, "x": 5.0, "y": 2.0}])
    data["cue_ball"]["ball_in_hand"] = "anywhere"

    upgraded = upgrade_layout(data)

    assert upgraded["cue_ball"] == {"id": "ball_0", "x": 2.0, "y": 2.0}
    assert upgraded["object_balls"] == [{"id": "ball_1", "x": 5.0, "y": 2.0}]


def test_the_first_pocket_target_becomes_the_target_pocket() -> None:
    data = minimal_v1(
        object_balls=[{"id": "ball_1", "x": 5.0, "y": 2.0}],
        targets=[
            circle_zone(1, 3.0, 2.0),
            pocket(2, "bottom_left", "ball_1"),
            pocket(3, "top_left"),
        ],
    )

    assert upgrade_layout(data)["target_pocket"] == "bottom_left"


def test_the_first_zone_becomes_the_landing_zone() -> None:
    data = minimal_v1(targets=[circle_zone(1, 3.0, 2.0), rect_zone(2, 6.0, 0.0, 2.0, 1.0)])

    assert upgrade_layout(data)["landing_zone"] == {"x": 3.0, "y": 2.0}


def test_a_rect_zone_lands_on_its_centre() -> None:
    data = minimal_v1(targets=[pocket(1, "top_left"), rect_zone(2, 3.5, 1.5, 1.0, 1.0)])

    upgraded = upgrade_layout(data)

    assert upgraded["landing_zone"] == {"x": 4.0, "y": 2.0}
    assert validate_layout(upgraded).errors == []


def test_a_rect_centre_is_rounded_to_three_decimals() -> None:
    data = minimal_v1(targets=[rect_zone(1, 1.0, 1.0, 0.334, 0.334)])

    assert upgrade_layout(data)["landing_zone"] == {"x": 1.167, "y": 1.167}


def test_zone_and_annotation_labels_and_text_are_dropped() -> None:
    data = minimal_v1(
        targets=[circle_zone(1, 3.0, 2.0, label="Cue ball finish")],
        annotations=[{"id": "annotation_1", "kind": "text", "x": 1.0, "y": 1.0, "text": "Note"}],
    )

    upgraded = upgrade_layout(data)

    assert set(upgraded) == {"schema_version", "table", "cue_ball", "object_balls", "landing_zone"}
    assert upgraded["landing_zone"] == {"x": 3.0, "y": 2.0}


def test_a_layout_without_targets_has_no_landing_zone_or_pocket() -> None:
    upgraded = upgrade_layout(minimal_v1())

    assert upgraded["object_balls"] == []
    assert "landing_zone" not in upgraded
    assert "target_pocket" not in upgraded
    assert "cue_spin" not in upgraded


def test_a_circle_zone_centred_on_a_rail_still_upgrades_to_a_valid_layout() -> None:
    # The upgrade must be total: every v1 layout that was valid becomes a valid v2 layout.
    data = minimal_v1(targets=[circle_zone(1, 8.0, 4.0)])

    upgraded = upgrade_layout(data)

    assert upgraded["landing_zone"] == {"x": 8.0, "y": 4.0}
    assert validate_layout(upgraded).errors == []
    assert LANDING_ZONE_RADIUS > 0


# Purity and other versions


def test_upgrading_does_not_change_the_stored_document() -> None:
    data = v1_fixture()
    before = copy.deepcopy(data)

    upgrade_layout(data)

    assert data == before


def test_upgrading_twice_gives_the_same_result() -> None:
    once = upgrade_layout(v1_fixture())

    assert upgrade_layout(once) == once


def test_a_v2_layout_is_returned_as_an_equal_copy() -> None:
    data = json.loads((FIXTURES / "layout_v2.json").read_text())

    upgraded = upgrade_layout(data)

    assert upgraded == data
    assert upgraded is not data


@pytest.mark.parametrize("schema_version", [0, 3, "1", None, 1.5])
def test_unknown_schema_versions_are_refused(schema_version: object) -> None:
    data = v1_fixture()
    data["schema_version"] = schema_version

    with pytest.raises(UnsupportedLayoutVersionError):
        upgrade_layout(data)


def test_a_layout_without_a_schema_version_is_refused() -> None:
    data = v1_fixture()
    del data["schema_version"]

    with pytest.raises(UnsupportedLayoutVersionError):
        upgrade_layout(data)


@pytest.mark.parametrize("data", [None, [], "layout", 3])
def test_a_non_object_is_refused(data: object) -> None:
    with pytest.raises(UnsupportedLayoutVersionError):
        upgrade_layout(data)


def test_a_malformed_v1_layout_is_refused_loudly() -> None:
    data = v1_fixture()
    del data["cue_ball"]

    with pytest.raises(ValueError, match="cue_ball"):
        upgrade_layout(data)
