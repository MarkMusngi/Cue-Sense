"""Tags, scoped to their owner."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ErrorDetail, ValidationFailedError
from app.db.session import violated_constraint
from app.models import Tag, User
from app.schemas.common import Page, Pagination
from app.schemas.tag import TagCreate, TagRead


def list_tags(db: Session, owner: User, pagination: Pagination) -> Page[TagRead]:
    query = select(Tag).where(Tag.owner_id == owner.id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    tags = db.scalars(
        query.order_by(func.lower(Tag.name), Tag.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return Page(
        items=[TagRead.model_validate(tag) for tag in tags],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


def create_tag(db: Session, owner: User, data: TagCreate) -> TagRead:
    existing = db.scalar(
        select(Tag.id).where(Tag.owner_id == owner.id, func.lower(Tag.name) == data.name.lower())
    )
    if existing is not None:
        raise _duplicate_name(data.name)
    tag = Tag(owner_id=owner.id, name=data.name, category=data.category)
    db.add(tag)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Another request created the same name between the check and the insert.
        if violated_constraint(exc) == "ix_tags_owner_id_name_lower_unique":
            raise _duplicate_name(data.name) from exc
        raise
    db.refresh(tag)
    return TagRead.model_validate(tag)


def _duplicate_name(name: str) -> ConflictError:
    return ConflictError("duplicate_tag_name", f"A tag named '{name}' already exists.")


def get_owned_tags(db: Session, owner: User, tag_ids: Sequence[uuid.UUID]) -> list[Tag]:
    """The owner's tags with these ids. Unknown or foreign ids are validation errors."""
    found = {
        tag.id: tag
        for tag in db.scalars(select(Tag).where(Tag.owner_id == owner.id, Tag.id.in_(tag_ids)))
    }
    missing = [
        ErrorDetail(
            code="unknown_tag", message=f"Tag {tag_id} does not exist.", path=["tag_ids", i]
        )
        for i, tag_id in enumerate(tag_ids)
        if tag_id not in found
    ]
    if missing:
        raise ValidationFailedError("Some tags do not exist.", missing)
    return list(found.values())
