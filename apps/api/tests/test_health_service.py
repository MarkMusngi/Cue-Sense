from sqlalchemy.orm import Session

from app.services.health_service import check_health


def test_check_health_reports_ok_when_database_answers(db_session: Session) -> None:
    health = check_health(db_session)

    assert health.status == "ok"
    assert health.database == "ok"


def test_check_health_reports_unavailable_when_database_is_down(
    unreachable_db_session: Session,
) -> None:
    health = check_health(unreachable_db_session)

    assert health.status == "degraded"
    assert health.database == "unavailable"
