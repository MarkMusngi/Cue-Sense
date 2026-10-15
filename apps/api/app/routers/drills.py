import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.common import Page, Pagination
from app.schemas.drill import (
    DrillCreate,
    DrillFilters,
    DrillRead,
    DrillStatusUpdate,
    DrillUpdate,
    DrillVersionRead,
)
from app.services import drill_service

router = APIRouter(prefix="/drills", tags=["drills"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_drill(body: DrillCreate, db: DbSession, user: CurrentUser) -> DrillRead:
    """Create a drill and its version 1, or duplicate one with source_drill_id."""
    return drill_service.create_drill(db, user, body)


@router.get("")
def list_drills(
    filters: Annotated[DrillFilters, Query()], db: DbSession, user: CurrentUser
) -> Page[DrillRead]:
    return drill_service.list_drills(db, user, filters)


@router.get("/{drill_id}")
def get_drill(drill_id: uuid.UUID, db: DbSession, user: CurrentUser) -> DrillRead:
    return drill_service.get_drill(db, user, drill_id)


@router.put("/{drill_id}")
def update_drill(
    drill_id: uuid.UUID, body: DrillUpdate, db: DbSession, user: CurrentUser
) -> DrillRead:
    return drill_service.update_drill(db, user, drill_id, body)


@router.patch("/{drill_id}")
def change_drill_status(
    drill_id: uuid.UUID, body: DrillStatusUpdate, db: DbSession, user: CurrentUser
) -> DrillRead:
    return drill_service.change_status(db, user, drill_id, body)


@router.delete("/{drill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drill(drill_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    drill_service.delete_drill(db, user, drill_id)


@router.get("/{drill_id}/versions")
def list_drill_versions(
    drill_id: uuid.UUID,
    pagination: Annotated[Pagination, Query()],
    db: DbSession,
    user: CurrentUser,
) -> Page[DrillVersionRead]:
    return drill_service.list_versions(db, user, drill_id, pagination)
