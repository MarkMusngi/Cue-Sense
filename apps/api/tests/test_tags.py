from sqlalchemy.orm import Session

from tests.conftest import make_client
from tests.factories import make_tag, make_user


def test_create_tag(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post(
        "/tags", json={"name": "  Banking  ", "category": "skill"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Banking"
    assert body["category"] == "skill"
    assert set(body) == {"id", "name", "category", "created_at"}


def test_tag_category_defaults_to_custom(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post("/tags", json={"name": "Warm-up"})

    assert response.json()["category"] == "custom"


def test_duplicate_tag_name_ignoring_case_is_a_conflict(db_session: Session) -> None:
    owner = make_user(db_session)
    make_tag(db_session, owner, name="Banking")

    response = make_client(db_session, owner).post("/tags", json={"name": "BANKING"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "duplicate_tag_name"


def test_same_tag_name_is_fine_for_another_owner(db_session: Session) -> None:
    make_tag(db_session, make_user(db_session), name="Banking")
    owner = make_user(db_session)

    response = make_client(db_session, owner).post("/tags", json={"name": "Banking"})

    assert response.status_code == 201


def test_blank_tag_name_is_rejected(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post("/tags", json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["path"] == ["name"]


def test_list_tags_is_scoped_sorted_and_paginated(db_session: Session) -> None:
    owner = make_user(db_session)
    for name in ["Cut", "bank", "Stop"]:
        make_tag(db_session, owner, name=name)
    make_tag(db_session, make_user(db_session), name="Other owner")
    client = make_client(db_session, owner)

    first = client.get("/tags", params={"limit": 2}).json()
    second = client.get("/tags", params={"limit": 2, "offset": 2}).json()

    assert [tag["name"] for tag in first["items"]] == ["bank", "Cut"]
    assert [tag["name"] for tag in second["items"]] == ["Stop"]
    assert (first["total"], first["limit"], first["offset"]) == (3, 2, 0)


def test_list_limit_is_capped(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get("/tags", params={"limit": 101})

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["path"] == ["query", "limit"]
