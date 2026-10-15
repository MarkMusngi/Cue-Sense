from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def get_db() -> Iterator[Session]:
    session_factory = sessionmaker(bind=get_engine())
    with session_factory() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]


def violated_constraint(exc: IntegrityError) -> str | None:
    """The name of the constraint or unique index an IntegrityError broke, if Postgres says."""
    diag = getattr(exc.orig, "diag", None)
    name = getattr(diag, "constraint_name", None)
    return name if isinstance(name, str) else None
