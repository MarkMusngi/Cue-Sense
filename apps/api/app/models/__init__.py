"""SQLAlchemy models. Import every model module here so Alembic autogenerate sees it."""

from app.db.base import Base
from app.models.attempt import Attempt
from app.models.drill import Drill
from app.models.drill_run import DrillRun
from app.models.drill_tag import DrillTag
from app.models.drill_version import DrillVersion
from app.models.practice_session import PracticeSession
from app.models.tag import Tag
from app.models.user import User

__all__ = [
    "Attempt",
    "Base",
    "Drill",
    "DrillRun",
    "DrillTag",
    "DrillVersion",
    "PracticeSession",
    "Tag",
    "User",
]
