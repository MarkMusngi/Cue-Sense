"""Drills and their versions, scoped to their owner (docs/architecture.md section 4.5).

Versions are never updated: a save that changes layout, instructions or scoring inserts
a new version and moves the drill's current version to it.
"""

import json
import re
import uuid
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, delete, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ErrorDetail, NotFoundError, ValidationFailedError
from app.db.session import violated_constraint
from app.models import Drill, DrillRun, DrillTag, DrillVersion, Tag, User
from app.schemas.common import Page, Pagination
from app.schemas.drill import (
    DrillCreate,
    DrillFilters,
    DrillRead,
    DrillStatus,
    DrillStatusUpdate,
    DrillUpdate,
    DrillVersionRead,
)
from app.schemas.tag import TagRead
from app.services.layout_service import validate_layout
from app.services.scoring_service import validate_scoring
from app.services.tag_service import get_owned_tags

# Archived drills can be unarchived; nothing goes back to draft.
_STATUS_CHANGES: dict[str, set[str]] = {
    "draft": {"active", "archived"},
    "active": {"archived"},
    "archived": {"active"},
}


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "drill"


def canonical_json(value: object) -> str:
    """JSON with sorted keys and numbers rounded to 3 decimals, so equal content compares
    equal regardless of key order, 2 vs 2.0, or float noise."""
    return json.dumps(_canonical(value), sort_keys=True, separators=(",", ":"))


def _canonical(value: object) -> object:
    if isinstance(value, float):
        rounded = round(value, 3)
        return int(rounded) if rounded.is_integer() else rounded
    if isinstance(value, dict):
        return {key: _canonical(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_canonical(item) for item in value]
    return value


def create_drill(db: Session, owner: User, data: DrillCreate) -> DrillRead:
    if data.source_drill_id is not None:
        return duplicate_drill(db, owner, data.source_drill_id)
    content = data.content()
    layout, scoring = _validate_content(content.layout, content.scoring)
    tags = get_owned_tags(db, owner, content.tag_ids)
    drill = Drill(
        owner_id=owner.id,
        title=content.title,
        slug=_unique_slug(db, owner, content.title),
        description=content.description,
        difficulty=content.difficulty,
    )
    db.add(drill)
    db.flush()
    _add_version(db, drill, 1, content.instructions, layout, scoring)
    _set_tags(db, drill, [tag.id for tag in tags])
    db.commit()
    return _read_one(db, drill)


def duplicate_drill(db: Session, owner: User, source_drill_id: uuid.UUID) -> DrillRead:
    """A new draft whose version 1 copies the source's current version, plus its tags."""
    source = _get_owned_drill(db, owner, source_drill_id)
    version = _current_version(db, source)
    title = f"{source.title} (copy)"
    duplicate = Drill(
        owner_id=owner.id,
        title=title,
        slug=_unique_slug(db, owner, title),
        description=source.description,
        difficulty=source.difficulty,
        source_drill_version_id=version.id,
    )
    db.add(duplicate)
    db.flush()
    _add_version(db, duplicate, 1, version.instructions, version.layout, version.scoring)
    _set_tags(db, duplicate, _tag_ids(db, source))
    db.commit()
    return _read_one(db, duplicate)


def list_drills(db: Session, owner: User, filters: DrillFilters) -> Page[DrillRead]:
    query = select(Drill).where(Drill.owner_id == owner.id)
    if filters.status is not None:
        query = query.where(Drill.status == filters.status)
    if filters.difficulty is not None:
        query = query.where(Drill.difficulty == filters.difficulty)
    if filters.tag_id is not None:
        query = query.where(
            exists().where(DrillTag.drill_id == Drill.id, DrillTag.tag_id == filters.tag_id)
        )
    if filters.search is not None:
        pattern = f"%{_escape_like(filters.search)}%"
        query = query.where(
            or_(
                Drill.title.ilike(pattern, escape="\\"),
                Drill.description.ilike(pattern, escape="\\"),
            )
        )
    total = _count(db, query)
    drills = db.scalars(
        query.order_by(func.lower(Drill.title), Drill.id)
        .limit(filters.limit)
        .offset(filters.offset)
    ).all()
    return Page(
        items=_read_many(db, drills), total=total, limit=filters.limit, offset=filters.offset
    )


def get_drill(db: Session, owner: User, drill_id: uuid.UUID) -> DrillRead:
    return _read_one(db, _get_owned_drill(db, owner, drill_id))


def update_drill(db: Session, owner: User, drill_id: uuid.UUID, data: DrillUpdate) -> DrillRead:
    """Save edits. Only a change to layout, instructions or scoring creates a version."""
    drill = _get_owned_drill(db, owner, drill_id)
    if data.base_drill_version_id != drill.current_drill_version_id:
        raise _stale_version()
    layout, scoring = _validate_content(data.layout, data.scoring)
    tags = get_owned_tags(db, owner, data.tag_ids)

    current = _current_version(db, drill)
    before = canonical_json([current.instructions, current.layout, current.scoring])
    if canonical_json([data.instructions, layout, scoring]) != before:
        _add_version(db, drill, current.version_number + 1, data.instructions, layout, scoring)
    drill.title = data.title
    drill.description = data.description
    drill.difficulty = data.difficulty
    _set_tags(db, drill, [tag.id for tag in tags])
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Two saves raced for the same version number; the later one is stale.
        if violated_constraint(exc) == "uq_drill_versions_drill_id_version_number":
            raise _stale_version() from exc
        raise
    return _read_one(db, drill)


def change_status(
    db: Session, owner: User, drill_id: uuid.UUID, data: DrillStatusUpdate
) -> DrillRead:
    """Activate, archive or unarchive. Archiving keeps every version and drill run."""
    drill = _get_owned_drill(db, owner, drill_id)
    if data.status != drill.status:
        if data.status not in _STATUS_CHANGES[drill.status]:
            raise ConflictError(
                "invalid_status_transition",
                f"A {drill.status} drill cannot become {data.status}.",
            )
        drill.status = data.status
        db.commit()
    return _read_one(db, drill)


def delete_drill(db: Session, owner: User, drill_id: uuid.UUID) -> None:
    """Hard-delete a draft without history, with its versions and tag links."""
    drill = _get_owned_drill(db, owner, drill_id)
    if drill.status != "draft" or _has_history(db, drill):
        raise ConflictError(
            "drill_not_deletable",
            "Only a draft drill with no drill runs can be deleted. Archive it instead.",
        )
    # Copies made from these versions keep their owner_id; the database clears the link.
    db.execute(delete(DrillVersion).where(DrillVersion.drill_id == drill.id))
    db.delete(drill)
    db.commit()


def list_versions(
    db: Session, owner: User, drill_id: uuid.UUID, pagination: Pagination
) -> Page[DrillVersionRead]:
    drill = _get_owned_drill(db, owner, drill_id)
    query = select(DrillVersion).where(DrillVersion.drill_id == drill.id)
    versions = db.scalars(
        query.order_by(DrillVersion.version_number.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return Page(
        items=[DrillVersionRead.model_validate(version) for version in versions],
        total=_count(db, query),
        limit=pagination.limit,
        offset=pagination.offset,
    )


def _get_owned_drill(db: Session, owner: User, drill_id: uuid.UUID) -> Drill:
    drill = db.scalar(select(Drill).where(Drill.id == drill_id, Drill.owner_id == owner.id))
    if drill is None:
        raise NotFoundError("Drill")
    return drill


def _current_version(db: Session, drill: Drill) -> DrillVersion:
    version = (
        db.get(DrillVersion, drill.current_drill_version_id)
        if drill.current_drill_version_id is not None
        else None
    )
    if version is None:
        raise NotFoundError("Drill version")
    return version


def _validate_content(
    layout: dict[str, Any], scoring: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Normalized layout and scoring, or one 422 listing every layout and scoring error."""
    layout_result = validate_layout(layout)
    scoring_result = validate_scoring(scoring)
    details = [
        ErrorDetail(code=error.code, message=error.message, path=["layout", *error.path])
        for error in layout_result.errors
    ]
    details.extend(
        ErrorDetail(code=error.code, message=error.message, path=["scoring", *error.path])
        for error in scoring_result.errors
    )
    if details:
        raise ValidationFailedError("The drill is invalid.", details)
    return (
        layout_result.require_layout().model_dump(mode="json", exclude_none=True),
        scoring_result.require_scoring().model_dump(mode="json"),
    )


def _add_version(
    db: Session,
    drill: Drill,
    version_number: int,
    instructions: str,
    layout: dict[str, Any],
    scoring: dict[str, Any],
) -> DrillVersion:
    version = DrillVersion(
        owner_id=drill.owner_id,
        drill_id=drill.id,
        version_number=version_number,
        instructions=instructions,
        layout=layout,
        scoring=scoring,
    )
    db.add(version)
    db.flush()
    drill.current_drill_version_id = version.id
    return version


def _unique_slug(db: Session, owner: User, title: str) -> str:
    base = slugify(title)
    taken = set(
        db.scalars(
            select(Drill.slug).where(
                Drill.owner_id == owner.id, or_(Drill.slug == base, Drill.slug.like(f"{base}-%"))
            )
        )
    )
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def _tag_ids(db: Session, drill: Drill) -> list[uuid.UUID]:
    return list(db.scalars(select(DrillTag.tag_id).where(DrillTag.drill_id == drill.id)))


def _set_tags(db: Session, drill: Drill, tag_ids: Sequence[uuid.UUID]) -> None:
    wanted = set(tag_ids)
    current = set(_tag_ids(db, drill))
    if current - wanted:
        db.execute(
            delete(DrillTag).where(
                DrillTag.drill_id == drill.id, DrillTag.tag_id.in_(current - wanted)
            )
        )
    db.add_all(
        DrillTag(owner_id=drill.owner_id, drill_id=drill.id, tag_id=tag_id)
        for tag_id in wanted - current
    )


def _has_history(db: Session, drill: Drill) -> bool:
    return bool(db.scalar(select(exists().where(DrillRun.drill_id == drill.id))))


def _count(db: Session, query: Select[Any]) -> int:
    return db.scalar(select(func.count()).select_from(query.subquery())) or 0


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _stale_version() -> ConflictError:
    return ConflictError(
        "stale_version", "The drill was saved since you loaded it. Reload it and save again."
    )


def _read_one(db: Session, drill: Drill) -> DrillRead:
    return _read_many(db, [drill])[0]


def _read_many(db: Session, drills: Sequence[Drill]) -> list[DrillRead]:
    """Drills with their current version and tags, in two queries for the whole page."""
    version_ids = [d.current_drill_version_id for d in drills if d.current_drill_version_id]
    versions = {
        version.id: DrillVersionRead.model_validate(version)
        for version in db.scalars(select(DrillVersion).where(DrillVersion.id.in_(version_ids)))
    }
    tags: dict[uuid.UUID, list[TagRead]] = defaultdict(list)
    rows = db.execute(
        select(DrillTag.drill_id, Tag)
        .join(Tag, (Tag.owner_id == DrillTag.owner_id) & (Tag.id == DrillTag.tag_id))
        .where(DrillTag.drill_id.in_([d.id for d in drills]))
        .order_by(func.lower(Tag.name), Tag.id)
    )
    for drill_id, tag in rows:
        tags[drill_id].append(TagRead.model_validate(tag))
    return [
        DrillRead(
            id=drill.id,
            title=drill.title,
            slug=drill.slug,
            description=drill.description,
            difficulty=drill.difficulty,
            status=_status(drill.status),
            source_drill_version_id=drill.source_drill_version_id,
            created_at=drill.created_at,
            updated_at=drill.updated_at,
            tags=tags[drill.id],
            current_version=versions.get(drill.current_drill_version_id)
            if drill.current_drill_version_id
            else None,
        )
        for drill in drills
    ]


_STATUSES: dict[str, DrillStatus] = {"draft": "draft", "active": "active", "archived": "archived"}


def _status(value: str) -> DrillStatus:
    """The column is text with a CHECK constraint; this narrows it to the Literal."""
    return _STATUSES[value]
