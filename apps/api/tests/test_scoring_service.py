import json
from pathlib import Path
from typing import Any

import pytest

from app.schemas.scoring import ScoredAttempt
from app.services.scoring_service import compute_set_progress, validate_scoring

VALID: list[dict[str, Any]] = [
    {"schema_version": 1, "kind": "success_count", "attempts_per_set": 10, "pass_threshold": 7},
    {"schema_version": 1, "kind": "streak", "streak_length": 5},
    {
        "schema_version": 1,
        "kind": "points",
        "attempts_per_set": 10,
        "max_points_per_attempt": 3,
        "pass_threshold": 20,
    },
    {
        "schema_version": 1,
        "kind": "timed",
        "attempts_per_set": 5,
        "time_limit_seconds": 90,
        "pass_threshold": 5,
    },
]


def pairs(data: object) -> list[tuple[str, list[str | int]]]:
    return [(error.code, error.path) for error in validate_scoring(data).errors]


@pytest.mark.parametrize("scoring", VALID, ids=[s["kind"] for s in VALID])
def test_each_scoring_kind_is_valid(scoring: dict[str, Any]) -> None:
    result = validate_scoring(scoring)

    assert result.errors == []
    assert result.scoring is not None
    assert result.scoring.model_dump() == scoring


def test_missing_schema_version_is_a_schema_error() -> None:
    scoring = dict(VALID[0])
    del scoring["schema_version"]

    assert pairs(scoring) == [("schema_invalid", ["schema_version"])]


def test_other_schema_version_is_unsupported() -> None:
    assert pairs({**VALID[1], "schema_version": 2}) == [
        ("unsupported_schema_version", ["schema_version"])
    ]


def test_unknown_kind_is_a_schema_error() -> None:
    assert [code for code, _ in pairs({**VALID[1], "kind": "golf"})] == ["schema_invalid"]


def test_field_errors_point_at_the_field_without_the_kind_tag() -> None:
    assert pairs({**VALID[0], "attempts_per_set": 0}) == [("schema_invalid", ["attempts_per_set"])]


def test_unknown_field_is_rejected() -> None:
    assert pairs({**VALID[1], "attemptsPerSet": 3}) == [("schema_invalid", ["attemptsPerSet"])]


@pytest.mark.parametrize(
    "scoring",
    [
        {**VALID[0], "pass_threshold": 11},
        {**VALID[2], "pass_threshold": 31},
        {**VALID[3], "pass_threshold": 6},
    ],
    ids=["success_count", "points", "timed"],
)
def test_pass_threshold_above_the_maximum_fails(scoring: dict[str, Any]) -> None:
    assert pairs(scoring) == [("pass_threshold_too_high", ["pass_threshold"])]


def test_pass_threshold_equal_to_the_maximum_passes() -> None:
    assert pairs({**VALID[2], "pass_threshold": 30}) == []


def test_non_object_scoring_is_a_schema_error() -> None:
    assert [code for code, _ in pairs("make 7 of 10")] == ["schema_invalid"]


def _fixture_path() -> Path:
    """The shared fixture lives at the repo root; Docker mounts it at /fixtures."""
    for root in (*Path(__file__).resolve().parents, Path("/")):
        candidate = root / "fixtures" / "scoring" / "set-progress-cases.json"
        if candidate.exists():
            return candidate
    pytest.fail("fixtures/scoring/set-progress-cases.json not found.")


SET_PROGRESS_CASES: list[dict[str, Any]] = json.loads(_fixture_path().read_text())["cases"]


@pytest.mark.parametrize("case", SET_PROGRESS_CASES, ids=[c["name"] for c in SET_PROGRESS_CASES])
def test_set_progress_matches_shared_fixture(case: dict[str, Any]) -> None:
    scoring = validate_scoring(case["scoring"]).require_scoring()
    attempts = [ScoredAttempt(**attempt) for attempt in case["attempts"]]

    progress = compute_set_progress(scoring, attempts).model_dump()

    expected = case["expected"]
    assert set(progress) == set(expected)
    for key, value in expected.items():
        if key == "success_rate" and value is not None:
            assert progress[key] == pytest.approx(value)
        else:
            assert progress[key] == value, key


def test_fixture_covers_all_four_scoring_kinds() -> None:
    kinds = {case["scoring"]["kind"] for case in SET_PROGRESS_CASES}

    assert kinds == {"success_count", "streak", "points", "timed"}
