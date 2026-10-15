import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, uuid_primary_key


class PracticeSession(Base):
    """One visit to the table."""

    __tablename__ = "practice_sessions"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        # At most one open session per owner.
        Index(
            "ix_practice_sessions_owner_id_open_unique",
            "owner_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ended_after_started"),
        Index("ix_practice_sessions_owner_id_started_at", "owner_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    ended_at: Mapped[datetime | None]
    location: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
