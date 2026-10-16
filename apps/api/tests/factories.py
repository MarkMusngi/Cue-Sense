"""Helpers that insert valid rows, so each test only spells out what it breaks."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    Attempt,
    Drill,
    DrillRun,
    DrillTag,
    DrillVersion,
    PracticeSession,
    Tag,
    User,
)

LAYOUT: dict[str, Any] = {
    "schema_version": 1,
    "table": {"kind": "pool", "size_ft": 9},
    "cue_ball": {"id": "ball_0", "x": 2.0, "y": 2.0, "ball_in_hand": "none"},
    "object_balls": [{"id": "ball_1", "number": 1, "x": 5.5, "y": 1.2}],
    "targets": [],
    "annotations": [],
}
SCORING: dict[str, Any] = {
    "schema_version": 1,
    "kind": "success_count",
    "attempts_per_set": 10,
    "pass_threshold": 7,
}


def make_user(db: Session, email: str | None = None) -> User:
    user = User(email=email or f"{uuid.uuid4().hex}@example.test")
    db.add(user)
    db.flush()
    return user


def make_drill(db: Session, owner: User, slug: str | None = None, **fields: Any) -> Drill:
    """A drill whose current version is version 1, created in one transaction."""
    scoring = fields.pop("scoring", SCORING)
    drill = Drill(
        owner_id=owner.id,
        title=fields.pop("title", "Straight-in"),
        slug=slug or uuid.uuid4().hex,
        difficulty=fields.pop("difficulty", 1),
        **fields,
    )
    db.add(drill)
    db.flush()
    version = make_version(db, drill, version_number=1, scoring=scoring)
    drill.current_drill_version_id = version.id
    db.flush()
    return drill


def make_version(db: Session, drill: Drill, version_number: int, **fields: Any) -> DrillVersion:
    version = DrillVersion(
        owner_id=fields.pop("owner_id", drill.owner_id),
        drill_id=drill.id,
        version_number=version_number,
        instructions=fields.pop("instructions", "Pocket the 1 ball."),
        layout=fields.pop("layout", LAYOUT),
        scoring=fields.pop("scoring", SCORING),
        **fields,
    )
    db.add(version)
    db.flush()
    return version


def make_tag(db: Session, owner: User, name: str | None = None) -> Tag:
    tag = Tag(owner_id=owner.id, name=name or uuid.uuid4().hex, category="skill")
    db.add(tag)
    db.flush()
    return tag


def make_drill_tag(db: Session, owner: User, drill: Drill, tag: Tag) -> DrillTag:
    link = DrillTag(owner_id=owner.id, drill_id=drill.id, tag_id=tag.id)
    db.add(link)
    db.flush()
    return link


def make_session(db: Session, owner: User, ended: bool = False, **fields: Any) -> PracticeSession:
    if ended:
        fields.setdefault("ended_at", datetime.now(UTC))
    practice_session = PracticeSession(owner_id=owner.id, **fields)
    db.add(practice_session)
    db.flush()
    return practice_session


def make_run(
    db: Session,
    owner: User,
    practice_session: PracticeSession,
    drill: Drill,
    run_number: int = 1,
    **fields: Any,
) -> DrillRun:
    run = DrillRun(
        owner_id=owner.id,
        practice_session_id=practice_session.id,
        drill_id=fields.pop("drill_id", drill.id),
        drill_version_id=fields.pop("drill_version_id", drill.current_drill_version_id),
        run_number=run_number,
        **fields,
    )
    db.add(run)
    db.flush()
    return run


def make_attempt(
    db: Session, owner: User, run: DrillRun, attempt_number: int = 1, **fields: Any
) -> Attempt:
    attempt = Attempt(
        owner_id=owner.id,
        drill_run_id=run.id,
        attempt_number=attempt_number,
        outcome=fields.pop("outcome", "success"),
        idempotency_key=fields.pop("idempotency_key", uuid.uuid4()),
        tapped_at=fields.pop("tapped_at", datetime.now(UTC)),
        **fields,
    )
    db.add(attempt)
    db.flush()
    return attempt
