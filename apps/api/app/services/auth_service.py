"""Sign up, sign in and the login sessions behind the session cookie.

The cookie holds a random token. Only its SHA-256 is stored, so a leaked database does not
leak working cookies. Passwords are hashed with argon2.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnauthenticatedError
from app.core.settings import get_settings
from app.models import LoginSession, User

_hasher = PasswordHasher()
# Verified against when the email is unknown, so sign-in takes about as long either way.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sign_up(db: Session, email: str, password: str) -> User:
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ConflictError("email_taken", "An account with that email already exists.")
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # Two sign-ups with the same email at once: the unique index decides.
        db.rollback()
        raise ConflictError("email_taken", "An account with that email already exists.") from exc
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    """The user for these credentials, or the same 401 for an unknown email, a wrong password
    and an account without a password."""
    user = db.scalar(select(User).where(User.email == email))
    stored = user.password_hash if user is not None else None
    try:
        _hasher.verify(stored or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        stored = None
    if user is None or stored is None:
        raise UnauthenticatedError("invalid_credentials", "The email or password is wrong.")
    return user


def start_login_session(db: Session, user: User) -> tuple[str, datetime]:
    """Create a login session and return its cookie token and expiry. Expired rows go too."""
    now = datetime.now(UTC)
    db.execute(delete(LoginSession).where(LoginSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=get_settings().session_ttl_hours)
    db.add(LoginSession(owner_id=user.id, token_hash=_hash_token(token), expires_at=expires_at))
    db.commit()
    return token, expires_at


def user_for_token(db: Session, token: str | None) -> User | None:
    """The signed-in user for a cookie token, or None when it is missing, unknown or expired."""
    if not token:
        return None
    return db.scalar(
        select(User)
        .join(LoginSession, LoginSession.owner_id == User.id)
        .where(LoginSession.token_hash == _hash_token(token))
        .where(LoginSession.expires_at > datetime.now(UTC))
    )


def end_login_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(LoginSession).where(LoginSession.token_hash == _hash_token(token)))
        db.commit()
