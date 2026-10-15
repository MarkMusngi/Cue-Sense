from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User
from app.scripts.seed import DEV_USER_EMAIL, seed_dev_user


def test_seed_creates_the_dev_user(db_session: Session) -> None:
    user = seed_dev_user(db_session)

    assert user.id is not None
    assert user.email == DEV_USER_EMAIL


def test_seed_is_idempotent(db_session: Session) -> None:
    first = seed_dev_user(db_session)
    second = seed_dev_user(db_session)

    count = db_session.scalar(
        select(func.count()).select_from(User).where(User.email == DEV_USER_EMAIL)
    )
    assert first.id == second.id
    assert count == 1
