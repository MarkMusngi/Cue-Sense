"""Layouts the web table editor produces (fixtures/layouts/editor-layouts.json).

The web app's Vitest regenerates this file from its placement helpers and fails if it
changes, so this test is the other half of the contract: every layout the editor can
produce must pass the API's layout validation.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.services.layout_service import validate_layout


def _fixture_path() -> Path:
    """The shared fixture lives at the repo root; Docker mounts it at /fixtures."""
    for root in (*Path(__file__).resolve().parents, Path("/")):
        candidate = root / "fixtures" / "layouts" / "editor-layouts.json"
        if candidate.exists():
            return candidate
    pytest.fail("fixtures/layouts/editor-layouts.json not found.")


CASES: list[dict[str, Any]] = json.loads(_fixture_path().read_text())["cases"]


def test_fixture_has_the_boundary_cases() -> None:
    names = {case["name"] for case in CASES}
    assert {
        "cue_ball_touching_cushion",
        "two_balls_exactly_touching",
        "fifteen_object_balls",
        "mirrored_horizontally",
        "mirrored_vertically",
    } <= names


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_editor_layout_passes_api_validation(case: dict[str, Any]) -> None:
    result = validate_layout(case["layout"])

    assert result.errors == []
    assert result.is_valid
