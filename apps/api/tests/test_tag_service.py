import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailedError
from app.services.tag_service import get_owned_tags
from tests.factories import make_tag, make_user


def test_get_owned_tags_returns_the_owners_tags_once_each(db_session: Session) -> None:
    owner = make_user(db_session)
    bank, cut = make_tag(db_session, owner), make_tag(db_session, owner)

    tags = get_owned_tags(db_session, owner, [cut.id, bank.id, cut.id])

    assert {tag.id for tag in tags} == {bank.id, cut.id}
    assert len(tags) == 2


def test_unknown_and_foreign_tags_are_validation_errors(db_session: Session) -> None:
    owner = make_user(db_session)
    mine = make_tag(db_session, owner)
    foreign = make_tag(db_session, make_user(db_session))

    with pytest.raises(ValidationFailedError) as raised:
        get_owned_tags(db_session, owner, [mine.id, foreign.id, uuid.uuid4()])

    assert [(d.code, d.path) for d in raised.value.details] == [
        ("unknown_tag", ["tag_ids", 1]),
        ("unknown_tag", ["tag_ids", 2]),
    ]
