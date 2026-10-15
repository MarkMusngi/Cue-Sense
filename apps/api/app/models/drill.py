from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


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
            use_alter=True,
        ),
        Index("ix_drills_owner_id_status", "owner_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(Text, server_default="draft")
    current_drill_version_id: Mapped[int | None] = mapped_column(BigInteger)
    source_drill_version_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
