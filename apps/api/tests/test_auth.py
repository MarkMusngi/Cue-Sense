import pytest
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.errors import AppError
from app.scripts.seed import DEV_USER_EMAIL
from tests.factories import make_user


def test_current_user_is_the_seeded_dev_user(db_session: Session) -> None:
    dev_user = make_user(db_session, email=DEV_USER_EMAIL)
    make_user(db_session)

    assert get_current_user(db_session) == dev_user


def test_missing_dev_user_is_a_503(db_session: Session) -> None:
    with pytest.raises(AppError) as raised:
        get_current_user(db_session)

    assert raised.value.status_code == 503
    assert raised.value.code == "dev_user_missing"
