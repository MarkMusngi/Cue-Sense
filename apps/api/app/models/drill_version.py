from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DrillVersion(Base):
    """Immutable snapshot of a drill (README decision 2). Never updated, only inserted."""

    __tablename__ = "drill_versions"
    __table_args__ = (
        UniqueConstraint("drill_id", "version_number"),
        UniqueConstraint("drill_id", "id"),
        UniqueConstraint("owner_id", "id"),
        ForeignKeyConstraint(["owner_id", "drill_id"], ["drills.owner_id", "drills.id"]),
        CheckConstraint("version_number >= 1", name="version_number_positive"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    drill_id: Mapped[int] = mapped_column(BigInteger)
    version_number: Mapped[int] = mapped_column(Integer)
    instructions: Mapped[str] = mapped_column(Text)
    layout: Mapped[dict[str, Any]] = mapped_column(JSONB)
    scoring: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
