"""The current user. A stub until real authentication arrives in Phase 3."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ServiceUnavailableError
from app.db.session import get_db
from app.models import User
from app.scripts.seed import DEV_USER_EMAIL


def get_current_user(db: Annotated[Session, Depends(get_db)]) -> User:
    """Return the seeded dev user. Real authentication replaces this one function."""
    user = db.scalar(select(User).where(User.email == DEV_USER_EMAIL))
    if user is None:
        raise ServiceUnavailableError(
            "dev_user_missing",
            "The dev user does not exist. Run: docker compose exec api python -m app.scripts.seed",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
