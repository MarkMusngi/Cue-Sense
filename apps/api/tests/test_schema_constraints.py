"""Database constraints from docs/architecture.md section 4.5, one rule per test."""

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
import pytest
from sqlalchemy import delete, func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Drill, DrillTag, DrillVersion, Tag
from tests.factories import (
    make_attempt,
    make_drill,
    make_drill_tag,
    make_run,
    make_session,
    make_tag,
    make_user,
    make_version,
)


@contextmanager
def violates(db: Session, constraint: str) -> Iterator[None]:
    """Expect the block to break `constraint`, checking deferred constraints too."""
    with pytest.raises(IntegrityError) as excinfo, db.begin_nested():
        yield
        db.flush()
        db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
    orig = excinfo.value.orig
    assert isinstance(orig, psycopg.Error)
    assert orig.diag.constraint_name == constraint


# Creating drills and versions


def test_drill_and_first_version_can_be_created_in_one_transaction(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)

    db_session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    assert drill.current_drill_version_id is not None


def test_current_version_must_belong_to_the_same_drill(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    other = make_drill(db_session, owner)

    with violates(db_session, "fk_drills_id_current_drill_version_id_drill_versions"):
        drill.current_drill_version_id = other.current_drill_version_id


# Unique constraints


def test_users_email_is_unique(db_session: Session) -> None:
    make_user(db_session, email="dup@example.test")

    with violates(db_session, "uq_users_email"):
        make_user(db_session, email="dup@example.test")


def test_drill_slug_is_unique_per_owner(db_session: Session) -> None:
    owner = make_user(db_session)
    make_drill(db_session, owner, slug="straight-in")

    with violates(db_session, "uq_drills_owner_id_slug"):
        make_drill(db_session, owner, slug="straight-in")


def test_same_drill_slug_is_allowed_for_different_owners(db_session: Session) -> None:
    make_drill(db_session, make_user(db_session), slug="straight-in")
    make_drill(db_session, make_user(db_session), slug="straight-in")


def test_version_number_is_unique_per_drill(db_session: Session) -> None:
    drill = make_drill(db_session, make_user(db_session))

    with violates(db_session, "uq_drill_versions_drill_id_version_number"):
        make_version(db_session, drill, version_number=1)


def test_tag_name_is_unique_per_owner(db_session: Session) -> None:
    owner = make_user(db_session)
    make_tag(db_session, owner, name="cut shots")

    with violates(db_session, "uq_tags_owner_id_name"):
        make_tag(db_session, owner, name="cut shots")


def test_run_number_is_unique_per_session(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner)
    drill = make_drill(db_session, owner)
    make_run(db_session, owner, practice_session, drill, run_number=1)

    with violates(db_session, "uq_drill_runs_practice_session_id_run_number"):
        make_run(db_session, owner, practice_session, drill, run_number=1)


def test_attempt_number_is_unique_per_run(db_session: Session) -> None:
    owner = make_user(db_session)
    run = make_run(
        db_session, owner, make_session(db_session, owner), make_drill(db_session, owner)
    )
    make_attempt(db_session, owner, run, attempt_number=1)

    with violates(db_session, "uq_attempts_drill_run_id_attempt_number"):
        make_attempt(db_session, owner, run, attempt_number=1)


def test_idempotency_key_is_unique_per_owner(db_session: Session) -> None:
    owner = make_user(db_session)
    run = make_run(
        db_session, owner, make_session(db_session, owner), make_drill(db_session, owner)
    )
    first = make_attempt(db_session, owner, run, attempt_number=1)

    with violates(db_session, "uq_attempts_owner_id_idempotency_key"):
        make_attempt(
            db_session, owner, run, attempt_number=2, idempotency_key=first.idempotency_key
        )


def test_owner_can_have_only_one_open_session(db_session: Session) -> None:
    owner = make_user(db_session)
    make_session(db_session, owner)

    with violates(db_session, "uq_practice_sessions_owner_id_open"):
        make_session(db_session, owner)


def test_closed_sessions_do_not_count_as_open(db_session: Session) -> None:
    owner = make_user(db_session)
    make_session(db_session, owner, ended=True)
    make_session(db_session, owner, ended=True)
    make_session(db_session, owner)


# Owner scoping (ADR 0001): a row can never reference another owner's data


def test_version_cannot_belong_to_another_owners_drill(db_session: Session) -> None:
    drill = make_drill(db_session, make_user(db_session))
    intruder = make_user(db_session)

    with violates(db_session, "fk_drill_versions_owner_id_drill_id_drills"):
        make_version(db_session, drill, version_number=2, owner_id=intruder.id)


def test_drill_tag_cannot_link_another_owners_tag(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    foreign_tag = make_tag(db_session, make_user(db_session))

    with violates(db_session, "fk_drill_tags_owner_id_tag_id_tags"):
        make_drill_tag(db_session, owner, drill, foreign_tag)


def test_drill_tag_cannot_link_another_owners_drill(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner)
    foreign_drill = make_drill(db_session, make_user(db_session))

    with violates(db_session, "fk_drill_tags_owner_id_drill_id_drills"):
        make_drill_tag(db_session, owner, foreign_drill, tag)


def test_drill_run_cannot_use_another_owners_session(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    foreign_session = make_session(db_session, make_user(db_session))

    with violates(db_session, "fk_drill_runs_owner_id_practice_session_id_practice_sessions"):
        make_run(db_session, owner, foreign_session, drill)


def test_drill_run_cannot_use_another_owners_drill(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner)
    foreign_drill = make_drill(db_session, make_user(db_session))

    with violates(db_session, "fk_drill_runs_owner_id_drill_id_drills"):
        make_run(db_session, owner, practice_session, foreign_drill)


def test_drill_run_version_must_belong_to_its_drill(db_session: Session) -> None:
    owner = make_user(db_session)
    practice_session = make_session(db_session, owner)
    drill = make_drill(db_session, owner)
    other = make_drill(db_session, owner)

    with violates(db_session, "fk_drill_runs_drill_id_drill_version_id_drill_versions"):
        make_run(
            db_session,
            owner,
            practice_session,
            drill,
            drill_version_id=other.current_drill_version_id,
        )


def test_attempt_cannot_belong_to_another_owners_run(db_session: Session) -> None:
    other_owner = make_user(db_session)
    foreign_run = make_run(
        db_session,
        other_owner,
        make_session(db_session, other_owner),
        make_drill(db_session, other_owner),
    )

    with violates(db_session, "fk_attempts_owner_id_drill_run_id_drill_runs"):
        make_attempt(db_session, make_user(db_session), foreign_run)


def test_source_version_cannot_belong_to_another_owner(db_session: Session) -> None:
    foreign_drill = make_drill(db_session, make_user(db_session))

    with violates(db_session, "fk_drills_owner_id_source_drill_version_id_drill_versions"):
        make_drill(
            db_session,
            make_user(db_session),
            source_drill_version_id=foreign_drill.current_drill_version_id,
        )


# Check constraints


@pytest.mark.parametrize("difficulty", [0, 6])
def test_drill_difficulty_must_be_between_1_and_5(db_session: Session, difficulty: int) -> None:
    with violates(db_session, "ck_drills_difficulty_range"):
        make_drill(db_session, make_user(db_session), difficulty=difficulty)


def test_drill_status_must_be_a_known_value(db_session: Session) -> None:
    with violates(db_session, "ck_drills_status_values"):
        make_drill(db_session, make_user(db_session), status="deleted")


def test_tag_category_must_be_a_known_value(db_session: Session) -> None:
    tag = make_tag(db_session, make_user(db_session))

    with violates(db_session, "ck_tags_category_values"):
        tag.category = "misc"


def test_attempt_outcome_must_be_a_known_value(db_session: Session) -> None:
    owner = make_user(db_session)
    run = make_run(
        db_session, owner, make_session(db_session, owner), make_drill(db_session, owner)
    )

    with violates(db_session, "ck_attempts_outcome_values"):
        make_attempt(db_session, owner, run, outcome="result")


# Delete behaviour: history is never cascade-deleted


def test_deleting_a_drill_with_versions_is_refused(db_session: Session) -> None:
    drill = make_drill(db_session, make_user(db_session))

    with violates(db_session, "fk_drill_versions_owner_id_drill_id_drills"):
        db_session.execute(delete(Drill).where(Drill.id == drill.id))


def test_deleting_a_version_used_by_a_drill_run_is_refused(db_session: Session) -> None:
    owner = make_user(db_session)
    drill = make_drill(db_session, owner)
    version_2 = make_version(db_session, drill, version_number=2)
    make_run(
        db_session, owner, make_session(db_session, owner), drill, drill_version_id=version_2.id
    )

    with violates(db_session, "fk_drill_runs_drill_id_drill_version_id_drill_versions"):
        db_session.execute(delete(DrillVersion).where(DrillVersion.id == version_2.id))


def test_deleting_a_tag_removes_its_links(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner)
    make_drill_tag(db_session, owner, make_drill(db_session, owner), tag)

    db_session.execute(delete(Tag).where(Tag.id == tag.id))

    assert db_session.scalar(select(func.count()).select_from(DrillTag)) == 0


# Reserved columns (ADR 0004)


def test_attempts_has_no_observations_column(db_session: Session) -> None:
    columns = {
        column["name"] for column in inspect(db_session.connection()).get_columns("attempts")
    }

    assert "observations" not in columns
