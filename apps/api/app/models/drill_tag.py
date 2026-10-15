from sqlalchemy import BigInteger, ForeignKey, ForeignKeyConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DrillTag(Base):
    """Link between a drill and a tag. Links are not history, so they cascade."""

    __tablename__ = "drill_tags"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_id", "drill_id"], ["drills.owner_id", "drills.id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["owner_id", "tag_id"], ["tags.owner_id", "tags.id"], ondelete="CASCADE"
        ),
        Index("ix_drill_tags_tag_id", "tag_id"),
    )

    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    drill_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    tag_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
