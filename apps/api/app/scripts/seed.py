"""Seed local development data. Safe to run more than once.

Usage: docker compose exec api python -m app.scripts.seed
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models import Drill, DrillVersion, User
from app.services.layout_service import validate_layout

# Stubbed dev user until real authentication in Phase 3. Synthetic, not a real address.
DEV_USER_EMAIL = "dev@cuesense.local"

TABLE: dict[str, Any] = {"kind": "pool", "size_ft": 9}


@dataclass(frozen=True)
class SeedDrill:
    slug: str
    title: str
    description: str
    difficulty: int
    instructions: str
    layout: dict[str, Any]
    scoring: dict[str, Any]


# The five seed drills from docs/architecture.md section 4.9. Together they use every
# scoring kind, so they double as fixtures for the scoring and stats work.
SEED_DRILLS: tuple[SeedDrill, ...] = (
    SeedDrill(
        slug="straight-in-three-distances",
        title="Straight-in at three distances",
        description="Straight-in shot into the corner from short, medium and long range.",
        difficulty=1,
        instructions=(
            "Shoot the 1 ball straight into the bottom-right corner. Take 3 attempts with the "
            "cue ball on each mark: short, then medium, then long. Respot after every attempt."
        ),
        layout={
            "schema_version": 1,
            "table": TABLE,
            "cue_ball": {"id": "ball_0", "x": 6.6, "y": 2.6, "ball_in_hand": "none"},
            "object_balls": [{"id": "ball_1", "number": 1, "x": 7.2, "y": 3.2}],
            "targets": [
                {"id": "target_1", "kind": "pocket", "pocket": "bottom_right", "ball_id": "ball_1"}
            ],
            "annotations": [
                {
                    "id": "annotation_1",
                    "kind": "line",
                    "points": [{"x": 4.6, "y": 0.6}, {"x": 8.0, "y": 4.0}],
                    "label": "Shot line",
                },
                {"id": "annotation_2", "kind": "text", "x": 6.6, "y": 2.3, "text": "Short"},
                {"id": "annotation_3", "kind": "text", "x": 5.6, "y": 1.3, "text": "Medium"},
                {"id": "annotation_4", "kind": "text", "x": 4.6, "y": 0.3, "text": "Long"},
            ],
        },
        scoring={
            "schema_version": 1,
            "kind": "success_count",
            "attempts_per_set": 9,
            "pass_threshold": 7,
        },
    ),
    SeedDrill(
        slug="thirty-degree-cut",
        title="30-degree cut",
        description="A 30-degree cut from the foot spot into the corner.",
        difficulty=2,
        instructions=(
            "Cut the 1 ball from the foot spot into the top-right corner. The cue ball path "
            "meets the object ball path at 30 degrees. Center ball, medium speed."
        ),
        layout={
            "schema_version": 1,
            "table": TABLE,
            # The ghost ball is at (5.873, 2.127): two radii back from the foot spot along
            # the pocket line. The cue ball is 2 diamonds back on a line 30 degrees off it.
            "cue_ball": {"id": "ball_0", "x": 3.941, "y": 2.645, "ball_in_hand": "none"},
            "object_balls": [{"id": "ball_1", "number": 1, "x": 6.0, "y": 2.0}],
            "targets": [
                {"id": "target_1", "kind": "pocket", "pocket": "top_right", "ball_id": "ball_1"}
            ],
            "annotations": [
                {
                    "id": "annotation_1",
                    "kind": "arrow",
                    "points": [{"x": 3.941, "y": 2.645}, {"x": 5.873, "y": 2.127}],
                    "label": "Aim at the ghost ball",
                },
                {
                    "id": "annotation_2",
                    "kind": "line",
                    "points": [{"x": 6.0, "y": 2.0}, {"x": 8.0, "y": 0.0}],
                },
            ],
        },
        scoring={
            "schema_version": 1,
            "kind": "success_count",
            "attempts_per_set": 10,
            "pass_threshold": 6,
        },
    ),
    SeedDrill(
        slug="stop-shot",
        title="Stop shot",
        description="Straight-in into the side pocket with the cue ball stopping dead.",
        difficulty=2,
        instructions=(
            "Shoot the 1 ball straight into the top side pocket with a stop shot. It counts "
            "only if the cue ball stops inside the circle where the 1 ball was."
        ),
        layout={
            "schema_version": 1,
            "table": TABLE,
            "cue_ball": {"id": "ball_0", "x": 4.0, "y": 2.6, "ball_in_hand": "none"},
            "object_balls": [{"id": "ball_1", "number": 1, "x": 4.0, "y": 1.0}],
            "targets": [
                {"id": "target_1", "kind": "pocket", "pocket": "top_middle", "ball_id": "ball_1"},
                {
                    "id": "target_2",
                    "kind": "zone",
                    "shape": "circle",
                    "ball_id": "ball_0",
                    "x": 4.0,
                    "y": 1.0,
                    "radius": 0.2,
                    "label": "Cue ball stops here",
                },
            ],
            "annotations": [
                {
                    "id": "annotation_1",
                    "kind": "text",
                    "x": 4.5,
                    "y": 2.6,
                    "text": "Below center, no side spin",
                },
            ],
        },
        scoring={"schema_version": 1, "kind": "streak", "streak_length": 5},
    ),
    SeedDrill(
        slug="position-to-zone",
        title="Position to zone",
        description="Pocket the ball and bring the cue ball to the middle of the table.",
        difficulty=3,
        instructions=(
            "Pocket the 1 ball in the top-right corner and leave the cue ball in the center "
            "box. Score 3 if pocketed with the cue ball in the box, 1 if pocketed with the "
            "cue ball outside it, 0 if missed."
        ),
        layout={
            "schema_version": 1,
            "table": TABLE,
            "cue_ball": {"id": "ball_0", "x": 5.0, "y": 2.0, "ball_in_hand": "none"},
            "object_balls": [{"id": "ball_1", "number": 1, "x": 6.8, "y": 0.8}],
            "targets": [
                {"id": "target_1", "kind": "pocket", "pocket": "top_right", "ball_id": "ball_1"},
                {
                    "id": "target_2",
                    "kind": "zone",
                    "shape": "rect",
                    "ball_id": "ball_0",
                    "x": 3.5,
                    "y": 1.5,
                    "width": 1.0,
                    "height": 1.0,
                    "label": "Center box",
                },
            ],
            "annotations": [],
        },
        scoring={
            "schema_version": 1,
            "kind": "points",
            "attempts_per_set": 10,
            "max_points_per_attempt": 3,
            "pass_threshold": 20,
        },
    ),
    SeedDrill(
        slug="five-ball-run-out",
        title="Five-ball run-out",
        description="Run five balls in numerical order with ball in hand.",
        difficulty=4,
        instructions=(
            "Place the balls as shown, take ball in hand, and pocket the 1 to 5 in order in "
            "any pocket. One attempt is one rack, and it succeeds if you clear all five "
            "within the time limit."
        ),
        layout={
            "schema_version": 1,
            "table": TABLE,
            "cue_ball": {"id": "ball_0", "x": 2.0, "y": 2.0, "ball_in_hand": "anywhere"},
            "object_balls": [
                {"id": "ball_1", "number": 1, "x": 3.0, "y": 1.0},
                {"id": "ball_2", "number": 2, "x": 5.0, "y": 3.0},
                {"id": "ball_3", "number": 3, "x": 6.5, "y": 1.5},
                {"id": "ball_4", "number": 4, "x": 2.5, "y": 3.2},
                {"id": "ball_5", "number": 5, "x": 7.0, "y": 3.5},
            ],
            "targets": [],
            "annotations": [
                {
                    "id": "annotation_1",
                    "kind": "text",
                    "x": 1.0,
                    "y": 0.5,
                    "text": "Ball in hand, shoot in order",
                },
            ],
        },
        scoring={
            "schema_version": 1,
            "kind": "timed",
            "attempts_per_set": 5,
            "time_limit_seconds": 120,
            "pass_threshold": 3,
        },
    ),
)


def seed_dev_user(db: Session) -> User:
    """Return the dev user, creating it if it does not exist yet."""
    user = db.scalar(select(User).where(User.email == DEV_USER_EMAIL))
    if user is None:
        user = User(email=DEV_USER_EMAIL)
        db.add(user)
        db.flush()
    return user


def seed_drills(db: Session, owner: User) -> list[Drill]:
    """Return the seed drills, creating any that do not exist yet. Matched on slug.

    Existing drills are left as they are, so changing a seed here does not edit them.
    """
    drills = []
    for seed in SEED_DRILLS:
        drill = db.scalar(select(Drill).where(Drill.owner_id == owner.id, Drill.slug == seed.slug))
        if drill is None:
            drill = _create_seed_drill(db, owner, seed)
        drills.append(drill)
    return drills


def _create_seed_drill(db: Session, owner: User, seed: SeedDrill) -> Drill:
    # require_layout raises if a seed layout is invalid, so a bad seed fails loudly.
    layout = validate_layout(seed.layout).require_layout()
    drill = Drill(
        owner_id=owner.id,
        title=seed.title,
        slug=seed.slug,
        description=seed.description,
        difficulty=seed.difficulty,
        status="active",
    )
    db.add(drill)
    db.flush()
    version = DrillVersion(
        owner_id=owner.id,
        drill_id=drill.id,
        version_number=1,
        instructions=seed.instructions,
        layout=layout.model_dump(mode="json", exclude_none=True),
        scoring=seed.scoring,
    )
    db.add(version)
    db.flush()
    drill.current_drill_version_id = version.id
    db.flush()
    return drill


def main() -> None:
    with Session(get_engine()) as db:
        user = seed_dev_user(db)
        drills = seed_drills(db, user)
        db.commit()
        print(f"Dev user ready: {user.email} (id {user.id})")
        print(f"Seed drills ready: {', '.join(drill.slug for drill in drills)}")


if __name__ == "__main__":
    main()
