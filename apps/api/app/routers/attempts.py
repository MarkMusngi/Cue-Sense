import uuid

from fastapi import APIRouter

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.attempt import AttemptRead, AttemptUpdate
from app.services import attempt_service

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.patch("/{attempt_id}")
def update_attempt(
    attempt_id: uuid.UUID, body: AttemptUpdate, db: DbSession, user: CurrentUser
) -> AttemptRead:
    """Correct an attempt, or undo it with voided_at."""
    return attempt_service.update_attempt(db, user, attempt_id, body)
