"""A NUL character in any text is a 422, not a 500 (Postgres text cannot hold it). An unpaired
surrogate is already refused as invalid JSON, and is kept here as a regression case.
Each case sends one request: after the database rejects a statement the session is spent."""

import json

import pytest
from sqlalchemy.orm import Session

from tests.conftest import make_client
from tests.factories import LAYOUT, SCORING, make_user

NUL = "a\u0000b"
SURROGATE = "a\ud800b"


def drill_body(**fields: object) -> dict[str, object]:
    return {
        "title": "Drill",
        "difficulty": 2,
        "tag_ids": [],
        "instructions": "Pocket it.",
        "layout": LAYOUT,
        "scoring": SCORING,
        **fields,
    }


@pytest.mark.parametrize("bad", [NUL, SURROGATE], ids=["nul", "surrogate"])
@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("post", "/drills", {"title": "{bad}"}),
        ("post", "/drills", {"instructions": "{bad}"}),
        ("post", "/drills", {"description": "{bad}"}),
        ("post", "/tags", {"name": "{bad}"}),
        ("post", "/practice-sessions", {"notes": "{bad}"}),
        ("post", "/practice-sessions", {"location": "{bad}"}),
    ],
)
def test_text_the_database_cannot_hold_is_422(
    db_session: Session, method: str, path: str, body: dict[str, str], bad: str
) -> None:
    owner = make_user(db_session)
    payload: dict[str, object] = {key: bad for key in body}
    if path == "/drills":
        payload = drill_body(**payload)

    # Raw JSON, because the test client cannot encode a lone surrogate itself.
    response = getattr(make_client(db_session, owner), method)(
        path, content=json.dumps(payload), headers={"content-type": "application/json"}
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert error["details"][0]["code"] in {"invalid_characters", "schema_invalid"}


def test_a_nul_in_a_search_is_422(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get("/drills", params={"search": NUL})

    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/users", "/login-sessions"])
def test_a_nul_in_an_email_is_422(db_session: Session, path: str) -> None:
    response = make_client(db_session).post(
        path, json={"email": "a\u0000@example.test", "password": "a-long-password"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
