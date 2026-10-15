"""Seed local development data. Safe to run more than once.

Usage: docker compose exec api python -m app.scripts.seed
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models import User

# Stubbed dev user until real authentication in Phase 3. Synthetic, not a real address.
DEV_USER_EMAIL = "dev@cuesense.local"


def seed_dev_user(db: Session) -> User:
    """Return the dev user, creating it if it does not exist yet."""
    user = db.scalar(select(User).where(User.email == DEV_USER_EMAIL))
    if user is None:
        user = User(email=DEV_USER_EMAIL)
        db.add(user)
        db.flush()
    return user


def main() -> None:
    with Session(get_engine()) as db:
        user = seed_dev_user(db)
        db.commit()
        print(f"Dev user ready: {user.email} (id {user.id})")


if __name__ == "__main__":
    main()
