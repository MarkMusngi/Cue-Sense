from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.common import Page, Pagination
from app.schemas.tag import TagCreate, TagRead
from app.services import tag_service

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
def list_tags(
    pagination: Annotated[Pagination, Query()], db: DbSession, user: CurrentUser
) -> Page[TagRead]:
    return tag_service.list_tags(db, user, pagination)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_tag(body: TagCreate, db: DbSession, user: CurrentUser) -> TagRead:
    return tag_service.create_tag(db, user, body)
