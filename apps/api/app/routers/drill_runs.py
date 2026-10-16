import uuid
from typing import Annotated

from fastapi import APIRouter, Header, Response, status

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.attempt import AttemptCreate, AttemptRead
from app.schemas.practice_session import DrillRunRead, DrillRunUpdate
from app.services import attempt_service, session_service

router = APIRouter(prefix="/drill-runs", tags=["drill-runs"])


@router.get("/{run_id}")
def get_drill_run(run_id: uuid.UUID, db: DbSession, user: CurrentUser) -> DrillRunRead:
    return session_service.get_drill_run(db, user, run_id)


@router.patch("/{run_id}")
def update_drill_run(
    run_id: uuid.UUID, body: DrillRunUpdate, db: DbSession, user: CurrentUser
) -> DrillRunRead:
    """End the drill run (ended_at), or change its notes."""
    return session_service.update_drill_run(db, user, run_id, body)


@router.post("/{run_id}/attempts", status_code=status.HTTP_201_CREATED)
def create_attempt(
    run_id: uuid.UUID,
    body: AttemptCreate,
    idempotency_key: Annotated[uuid.UUID, Header()],
    response: Response,
    db: DbSession,
    user: CurrentUser,
) -> AttemptRead:
    """Log one attempt. A replayed Idempotency-Key returns the original with 200."""
    attempt, created = attempt_service.create_attempt(db, user, run_id, idempotency_key, body)
    if not created:
        response.status_code = status.HTTP_200_OK
    return attempt
