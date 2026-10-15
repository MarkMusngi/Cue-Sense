import uuid
from datetime import datetime

from sqlalchemy import DateTime, MetaData, Uuid, text
from sqlalchemy.orm import DeclarativeBase, MappedColumn, mapped_column

# Stable, predictable constraint names so later migrations can refer to them.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models. Alembic reads Base.metadata."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    # Every timestamp is timestamptz (docs/architecture.md section 4.5).
    type_annotation_map = {datetime: DateTime(timezone=True), uuid.UUID: Uuid}


def uuid_primary_key() -> MappedColumn[uuid.UUID]:
    """A UUID primary key. Python generates it on insert; the database can too."""
    return mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
