from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.schemas.health import HealthResponse


def check_health(db: Session) -> HealthResponse:
    """Report API status and whether the database answers a trivial query."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return HealthResponse(status="degraded", database="unavailable")
    return HealthResponse(status="ok", database="ok")
