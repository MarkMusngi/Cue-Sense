from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, Index, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PracticeSession(Base):
    """One visit to the table."""

    __tablename__ = "practice_sessions"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        # At most one open session per owner.
        Index(
            "uq_practice_sessions_owner_id_open",
            "owner_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
        Index("ix_practice_sessions_owner_id_started_at", "owner_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    ended_at: Mapped[datetime | None]
    location: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
