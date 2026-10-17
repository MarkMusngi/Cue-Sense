import copy
import json
from dataclasses import replace
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.models import Drill, DrillVersion, User
from app.scripts.seed import (
    DEV_USER_EMAIL,
    SEED_DRILLS,
    SeedDrill,
    _create_seed_drill,
    seed_dev_user,
    seed_drills,
)
from app.services.layout_service import upgrade_layout, validate_layout

SEED_SLUGS = {
    "straight-in-three-distances",
    "thirty-degree-cut",
    "stop-shot",
    "position-to-zone",
    "five-ball-run-out",
}
SCORING_KINDS = {"success_count", "streak", "points", "timed"}
FIXTURES = Path(__file__).resolve().parent / "fixtures"


def count_owned(db: Session, model: type[Drill] | type[DrillVersion], owner: User) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.owner_id == owner.id)) or 0


def test_seed_creates_the_dev_user(db_session: Session) -> None:
    user = seed_dev_user(db_session)

    assert user.id is not None
    assert user.email == DEV_USER_EMAIL


def test_seed_gives_the_dev_user_a_password_once(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(database_url="unused", dev_user_password=SecretStr("seed-password-1"))
    monkeypatch.setattr("app.scripts.seed.get_settings", lambda: settings)

    user = seed_dev_user(db_session)
    first_hash = user.password_hash
    seed_dev_user(db_session)

    assert first_hash is not None and first_hash.startswith("$argon2")
    assert user.password_hash == first_hash  # an existing password is not replaced


def test_seed_without_a_password_leaves_none(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(database_url="unused", dev_user_password=None)
    monkeypatch.setattr("app.scripts.seed.get_settings", lambda: settings)

    assert seed_dev_user(db_session).password_hash is None


def test_seed_is_idempotent(db_session: Session) -> None:
    first = seed_dev_user(db_session)
    second = seed_dev_user(db_session)

    count = db_session.scalar(
        select(func.count()).select_from(User).where(User.email == DEV_USER_EMAIL)
    )
    assert first.id == second.id
    assert count == 1


def test_seed_creates_the_five_drills_with_a_first_version(db_session: Session) -> None:
    user = seed_dev_user(db_session)

    drills = seed_drills(db_session, user)

    assert {drill.slug for drill in drills} == SEED_SLUGS
    assert count_owned(db_session, Drill, user) == 5
    for drill in drills:
        version = db_session.get(DrillVersion, drill.current_drill_version_id)
        assert version is not None
        assert version.drill_id == drill.id
        assert version.owner_id == user.id
        assert version.version_number == 1
        assert version.instructions
        assert drill.status == "active"


def test_every_seeded_layout_and_scoring_is_valid(db_session: Session) -> None:
    user = seed_dev_user(db_session)

    drills = seed_drills(db_session, user)

    for drill in drills:
        version = db_session.get(DrillVersion, drill.current_drill_version_id)
        assert version is not None
        result = validate_layout(version.layout)
        assert result.errors == [], drill.slug
        # The stored layout is the normalized one, so validating it changes nothing.
        assert result.require_layout().model_dump(mode="json", exclude_none=True) == version.layout
        assert version.layout["schema_version"] == 2
        assert version.scoring["schema_version"] == 1
        assert version.scoring["kind"] in SCORING_KINDS


def test_seed_drills_cover_every_scoring_kind() -> None:
    assert {seed.scoring["kind"] for seed in SEED_DRILLS} == SCORING_KINDS


def test_seed_drills_rerun_is_a_noop(db_session: Session) -> None:
    user = seed_dev_user(db_session)
    first = seed_drills(db_session, user)

    second = seed_drills(db_session, user)

    assert {drill.id: drill.current_drill_version_id for drill in second} == {
        drill.id: drill.current_drill_version_id for drill in first
    }
    assert count_owned(db_session, Drill, user) == 5
    assert count_owned(db_session, DrillVersion, user) == 5


@pytest.mark.parametrize("seed", SEED_DRILLS, ids=lambda seed: seed.slug)
def test_seed_layouts_keep_what_the_original_schema_version_1_drills_had(seed: SeedDrill) -> None:
    original = json.loads((FIXTURES / "seed_layouts_v1.json").read_text())[seed.slug]

    assert seed.layout == upgrade_layout(original)


def test_a_seed_with_an_invalid_layout_names_the_drill_and_the_errors(
    db_session: Session,
) -> None:
    user = seed_dev_user(db_session)
    layout = copy.deepcopy(SEED_DRILLS[0].layout)
    layout["cue_ball"]["x"] = 0.0
    broken = replace(SEED_DRILLS[0], slug="broken-seed", layout=layout)

    with pytest.raises(ValueError, match=r"broken-seed.*ball_out_of_bounds"):
        _create_seed_drill(db_session, user, broken)
