from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Drill, DrillVersion, User
from app.scripts.seed import DEV_USER_EMAIL, SEED_DRILLS, seed_dev_user, seed_drills
from app.services.layout_service import validate_layout

SEED_SLUGS = {
    "straight-in-three-distances",
    "thirty-degree-cut",
    "stop-shot",
    "position-to-zone",
    "five-ball-run-out",
}
SCORING_KINDS = {"success_count", "streak", "points", "timed"}


def count_owned(db: Session, model: type[Drill] | type[DrillVersion], owner: User) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.owner_id == owner.id)) or 0


def test_seed_creates_the_dev_user(db_session: Session) -> None:
    user = seed_dev_user(db_session)

    assert user.id is not None
    assert user.email == DEV_USER_EMAIL


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
