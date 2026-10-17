"""The current user, from the session cookie (docs/authentication.md)."""

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.errors import UnauthenticatedError
from app.db.session import get_db
from app.models import User
from app.services import auth_service

SESSION_COOKIE = "cue_session"


def get_session_token(
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> str | None:
    return token


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Depends(get_session_token)],
) -> User:
    """The signed-in user, or a 401. Every other service and router takes the user from here."""
    user = auth_service.user_for_token(db, token)
    if user is None:
        raise UnauthenticatedError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
