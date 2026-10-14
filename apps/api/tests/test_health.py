from sqlalchemy.orm import Session

from tests.conftest import make_client


def test_get_health_returns_200_when_database_answers(db_session: Session) -> None:
    response = make_client(db_session).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_get_health_returns_503_when_database_is_down(unreachable_db_session: Session) -> None:
    response = make_client(unreachable_db_session).get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}
