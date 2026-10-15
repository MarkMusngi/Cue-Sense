import pytest

from app.services.drill_service import canonical_json, slugify


@pytest.mark.parametrize(
    ("title", "slug"),
    [
        ("Straight-in", "straight-in"),
        ("  30° Cut, Left Side!  ", "30-cut-left-side"),
        ("Five-ball run-out (copy)", "five-ball-run-out-copy"),
        ("!!!", "drill"),
    ],
)
def test_slugify(title: str, slug: str) -> None:
    assert slugify(title) == slug


def test_canonical_json_ignores_key_order() -> None:
    assert canonical_json({"b": 1, "a": {"y": 2, "x": 1}}) == canonical_json(
        {"a": {"x": 1, "y": 2}, "b": 1}
    )


def test_canonical_json_treats_whole_floats_as_ints_and_rounds() -> None:
    assert canonical_json({"x": 2.0, "y": [1.20004]}) == canonical_json({"x": 2, "y": [1.2]})


def test_canonical_json_sees_real_changes() -> None:
    assert canonical_json({"x": 2.0}) != canonical_json({"x": 2.001})
    assert canonical_json({"text": "a"}) != canonical_json({"text": "b"})
