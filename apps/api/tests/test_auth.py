"""Sign up, sign in, sign out and the session cookie. These tests send real cookies: no
get_current_user override."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.auth import SESSION_COOKIE
from app.core.settings import Settings, get_settings
from app.models import LoginSession, User
from app.services.auth_service import hash_password
from tests.conftest import make_client
from tests.factories import (
    make_attempt,
    make_drill,
    make_run,
    make_session,
    make_user,
)

PASSWORD = "correct horse battery"


@pytest.fixture
def default_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Settings as a deployment that sets nothing about the cookie would have them. The test
    environment itself turns Secure off (as .env.example does for local http)."""
    monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)
    get_settings.cache_clear()
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


def user_with_password(db: Session, email: str = "player@example.test") -> User:
    user = make_user(db, email=email)
    user.password_hash = hash_password(PASSWORD)
    db.flush()
    return user


def sign_in(
    client: TestClient, email: str = "player@example.test", password: str = PASSWORD
) -> Response:
    return client.post("/login-sessions", json={"email": email, "password": password})


# Sign up


def test_sign_up_creates_the_user_and_signs_in(db_session: Session) -> None:
    client = make_client(db_session)

    response = client.post("/users", json={"email": "New@Example.test ", "password": PASSWORD})

    assert response.status_code == 201
    assert response.json()["email"] == "new@example.test"
    assert "password" not in response.text
    assert client.get("/users/me").json()["email"] == "new@example.test"
    user = db_session.scalar(select(User).where(User.email == "new@example.test"))
    assert user is not None
    assert user.password_hash is not None
    assert user.password_hash.startswith("$argon2")
    assert PASSWORD not in user.password_hash


def test_sign_up_with_a_taken_email_is_409(db_session: Session) -> None:
    user_with_password(db_session)

    response = make_client(db_session).post(
        "/users", json={"email": "PLAYER@example.test", "password": PASSWORD}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_sign_up_rejects_a_short_password_without_echoing_it(db_session: Session) -> None:
    response = make_client(db_session).post(
        "/users", json={"email": "a@example.test", "password": "short"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["path"] == ["password"]
    assert "short" not in response.text.replace("too short", "")


def test_sign_up_rejects_a_bad_email(db_session: Session) -> None:
    response = make_client(db_session).post(
        "/users", json={"email": "not-an-email", "password": PASSWORD}
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["path"] == ["email"]


# Sign in


def test_sign_in_sets_an_http_only_cookie_and_stores_only_a_hash(
    db_session: Session, default_settings: None
) -> None:
    user = user_with_password(db_session)
    client = make_client(db_session)

    response = sign_in(client)

    assert response.status_code == 201
    assert response.json()["id"] == str(user.id)
    set_cookie = response.headers["set-cookie"]
    assert f"{SESSION_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Secure" in set_cookie
    token = client.cookies[SESSION_COOKIE]
    stored = db_session.scalar(select(LoginSession).where(LoginSession.owner_id == user.id))
    assert stored is not None
    assert stored.token_hash != token
    assert token not in stored.token_hash


def test_wrong_password_and_unknown_email_look_the_same(db_session: Session) -> None:
    user_with_password(db_session)
    client = make_client(db_session)

    wrong = sign_in(client, password="not the password")
    unknown = sign_in(client, email="nobody@example.test")

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"
    assert SESSION_COOKIE not in client.cookies


def test_an_account_without_a_password_cannot_sign_in(db_session: Session) -> None:
    make_user(db_session, email="nopass@example.test")

    response = sign_in(make_client(db_session), email="nopass@example.test")

    assert response.status_code == 401


def test_the_cookie_is_secure_by_default_and_not_when_turned_off(
    db_session: Session, default_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    user_with_password(db_session)
    assert Settings(database_url="unused").session_cookie_secure is True

    local = Settings(database_url="unused", session_cookie_secure=False)
    monkeypatch.setattr("app.routers.auth.get_settings", lambda: local)
    response = sign_in(make_client(db_session))

    assert "Secure" not in response.headers["set-cookie"]


# The current user


def test_me_without_a_cookie_is_401(db_session: Session) -> None:
    response = make_client(db_session).get("/users/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_a_data_endpoint_without_a_cookie_is_401(db_session: Session) -> None:
    response = make_client(db_session).get("/drills")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_an_unknown_token_is_401(db_session: Session) -> None:
    client = make_client(db_session)
    client.cookies.set(SESSION_COOKIE, "not-a-real-token")

    assert client.get("/users/me").status_code == 401


def test_an_expired_session_is_401(db_session: Session) -> None:
    user = user_with_password(db_session)
    client = make_client(db_session)
    sign_in(client)
    assert client.get("/users/me").status_code == 200

    db_session.execute(
        update(LoginSession)
        .where(LoginSession.owner_id == user.id)
        .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    db_session.flush()

    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_signing_in_again_removes_expired_sessions(db_session: Session) -> None:
    user = user_with_password(db_session)
    db_session.add(
        LoginSession(
            owner_id=user.id,
            token_hash="old",
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )
    )
    db_session.flush()

    sign_in(make_client(db_session))

    hashes = db_session.scalars(
        select(LoginSession.token_hash).where(LoginSession.owner_id == user.id)
    ).all()
    assert "old" not in hashes
    assert len(hashes) == 1


# Sign out


def test_sign_out_ends_the_session(db_session: Session) -> None:
    user = user_with_password(db_session)
    client = make_client(db_session)
    sign_in(client)
    token = client.cookies[SESSION_COOKIE]

    response = client.delete("/login-sessions/current")

    assert response.status_code == 204
    assert db_session.scalar(select(LoginSession).where(LoginSession.owner_id == user.id)) is None
    # The old cookie no longer works, even if a client kept it.
    client.cookies.set(SESSION_COOKIE, token)
    assert client.get("/users/me").status_code == 401


def test_sign_out_without_a_cookie_is_fine(db_session: Session) -> None:
    assert make_client(db_session).delete("/login-sessions/current").status_code == 204


def test_sign_out_leaves_other_sign_ins_alone(db_session: Session) -> None:
    user_with_password(db_session)
    laptop = make_client(db_session)
    phone = make_client(db_session)
    sign_in(laptop)
    sign_in(phone)

    laptop.delete("/login-sessions/current")

    assert phone.get("/users/me").status_code == 200


# Owner scoping through real cookies


def test_one_user_cannot_read_another_users_data(db_session: Session) -> None:
    alice = user_with_password(db_session, "alice@example.test")
    user_with_password(db_session, "bob@example.test")
    drill = make_drill(db_session, alice)
    session = make_session(db_session, alice)
    run = make_run(db_session, alice, session, drill)
    attempt = make_attempt(db_session, alice, run, 1)

    bob = make_client(db_session)
    sign_in(bob, email="bob@example.test")
    alice_client = make_client(db_session)
    sign_in(alice_client, email="alice@example.test")

    assert alice_client.get(f"/drills/{drill.id}").status_code == 200
    for path in (
        f"/drills/{drill.id}",
        f"/practice-sessions/{session.id}",
        f"/drill-runs/{run.id}",
        f"/drill-runs/{run.id}/attempts",
    ):
        assert bob.get(path).status_code == 404, path
    assert bob.patch(f"/attempts/{attempt.id}", json={"voided_at": None}).status_code == 404
    assert bob.get("/drills").json()["total"] == 0
    assert bob.get("/practice-sessions").json()["total"] == 0
