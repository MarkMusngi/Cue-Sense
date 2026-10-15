import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, uuid_primary_key


class DrillRun(Base):
    """One drill performed inside a practice session, pinned to a drill version."""

    __tablename__ = "drill_runs"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        UniqueConstraint("practice_session_id", "run_number"),
        ForeignKeyConstraint(
            ["owner_id", "practice_session_id"],
            ["practice_sessions.owner_id", "practice_sessions.id"],
        ),
        ForeignKeyConstraint(["owner_id", "drill_id"], ["drills.owner_id", "drills.id"]),
        # drill_id is stored for cheap per-drill queries; this pair keeps it in sync.
        ForeignKeyConstraint(
            ["drill_id", "drill_version_id"], ["drill_versions.drill_id", "drill_versions.id"]
        ),
        CheckConstraint("run_number >= 1", name="run_number_positive"),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ended_after_started"),
        Index("ix_drill_runs_owner_id_started_at", "owner_id", "started_at"),
        Index("ix_drill_runs_drill_id_started_at", "drill_id", "started_at"),
        Index("ix_drill_runs_drill_version_id", "drill_version_id"),
        Index("ix_drill_runs_practice_session_id", "practice_session_id"),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    practice_session_id: Mapped[uuid.UUID]
    drill_id: Mapped[uuid.UUID]
    drill_version_id: Mapped[uuid.UUID]
    run_number: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    ended_at: Mapped[datetime | None]
    notes: Mapped[str | None] = mapped_column(Text)
