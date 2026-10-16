import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.common import Page, Pagination
from app.schemas.practice_session import (
    DrillRunCreate,
    DrillRunRead,
    PracticeSessionCreate,
    PracticeSessionDetail,
    PracticeSessionRead,
    PracticeSessionUpdate,
)
from app.services import session_service

router = APIRouter(prefix="/practice-sessions", tags=["practice-sessions"])


@router.post("", status_code=status.HTTP_201_CREATED)
def start_session(
    body: PracticeSessionCreate, db: DbSession, user: CurrentUser
) -> PracticeSessionRead:
    """Start a practice session, closing any open one."""
    return session_service.start_session(db, user, body)


@router.get("")
def list_sessions(
    pagination: Annotated[Pagination, Query()], db: DbSession, user: CurrentUser
) -> Page[PracticeSessionRead]:
    return session_service.list_sessions(db, user, pagination)


@router.get("/{session_id}")
def get_session(session_id: uuid.UUID, db: DbSession, user: CurrentUser) -> PracticeSessionDetail:
    return session_service.get_session(db, user, session_id)


@router.patch("/{session_id}")
def update_session(
    session_id: uuid.UUID, body: PracticeSessionUpdate, db: DbSession, user: CurrentUser
) -> PracticeSessionRead:
    """Finish the session (ended_at), or change its location or notes."""
    return session_service.update_session(db, user, session_id, body)


@router.post("/{session_id}/drill-runs", status_code=status.HTTP_201_CREATED)
def start_drill_run(
    session_id: uuid.UUID, body: DrillRunCreate, db: DbSession, user: CurrentUser
) -> DrillRunRead:
    """Start a drill run on the drill's current version."""
    return session_service.start_drill_run(db, user, session_id, body)
