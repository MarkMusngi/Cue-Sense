from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.auth import SESSION_COOKIE, CurrentUser, get_session_token
from app.core.settings import get_settings
from app.db.session import DbSession
from app.models import User
from app.schemas.auth import Credentials, UserRead
from app.services import auth_service

router = APIRouter(tags=["auth"])

SessionToken = Annotated[str | None, Depends(get_session_token)]


def _sign_in(db: DbSession, response: Response, user: User) -> UserRead:
    """Start a login session for the user and put its token in the cookie."""
    token, _ = auth_service.start_login_session(db, user)
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )
    return UserRead.model_validate(user)


@router.post("/users", status_code=status.HTTP_201_CREATED)
def sign_up(body: Credentials, response: Response, db: DbSession) -> UserRead:
    """Create an account and sign in."""
    user = auth_service.sign_up(db, body.email, body.password.get_secret_value())
    return _sign_in(db, response, user)


@router.post("/login-sessions", status_code=status.HTTP_201_CREATED)
def sign_in(body: Credentials, response: Response, db: DbSession) -> UserRead:
    user = auth_service.authenticate(db, body.email, body.password.get_secret_value())
    return _sign_in(db, response, user)


@router.delete("/login-sessions/current", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(response: Response, db: DbSession, token: SessionToken) -> None:
    auth_service.end_login_session(db, token)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/users/me")
def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)
