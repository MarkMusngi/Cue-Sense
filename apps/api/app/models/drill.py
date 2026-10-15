import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, uuid_primary_key


class Drill(Base):
    """A reusable exercise. Layout, instructions and scoring live on its versions."""

    __tablename__ = "drills"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        UniqueConstraint("owner_id", "slug"),
        CheckConstraint("difficulty BETWEEN 1 AND 5", name="difficulty_range"),
        CheckConstraint("status IN ('draft', 'active', 'archived')", name="status_values"),
        # The current version must be one of this drill's own versions. Deferred so a
        # drill and its first version can be inserted in one transaction.
        ForeignKeyConstraint(
            ["id", "current_drill_version_id"],
            ["drill_versions.drill_id", "drill_versions.id"],
            deferrable=True,
            initially="DEFERRED",
            use_alter=True,
        ),
        ForeignKeyConstraint(
            ["owner_id", "source_drill_version_id"],
            ["drill_versions.owner_id", "drill_versions.id"],
            # Hard-deleting a draft clears the link on its copies, not their owner_id.
            ondelete="SET NULL (source_drill_version_id)",
            use_alter=True,
        ),
        Index("ix_drills_owner_id_status", "owner_id", "status"),
        Index(
            "ix_drills_source_drill_version_id",
            "source_drill_version_id",
            postgresql_where=text("source_drill_version_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(Text, server_default="draft")
    current_drill_version_id: Mapped[uuid.UUID | None]
    source_drill_version_id: Mapped[uuid.UUID | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    # Refreshed by the set_drills_updated_at trigger, so raw SQL updates count too.
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())
