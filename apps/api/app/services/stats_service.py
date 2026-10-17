"""Dashboard numbers (docs/stats-contract.md). Aggregation happens in SQL: this module only
turns a date range into timestamps, runs the grouped queries and fills the gaps the
contract asks to be filled."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Date, Select, cast, distinct, func, select
from sqlalchemy.orm import Session

from app.core.errors import ErrorDetail, NotFoundError, ValidationFailedError
from app.models import Attempt, Drill, DrillRun, DrillTag, DrillVersion, PracticeSession, Tag, User
from app.schemas.stats import (
    Bucket,
    SuccessRatePoint,
    SuccessRateStats,
    SuccessRateVersion,
    TagStats,
    TagStatsItem,
    WeeklyVolumeItem,
    WeeklyVolumeStats,
)

DEFAULT_DAYS = 90
MAX_DAYS = 366


@dataclass(frozen=True)
class StatsRange:
    """The requested days, as dates, and as the instants that bound them in the zone."""

    from_date: date
    to_date: date
    tz: str
    start: datetime  # first instant of from_date in tz
    end: datetime  # first instant after to_date in tz


def _invalid(name: str, message: str) -> ValidationFailedError:
    return ValidationFailedError(
        "The request is invalid.",
        [ErrorDetail(code="schema_invalid", message=message, path=["query", name])],
    )


def resolve_range(from_date: date | None, to_date: date | None, tz: str) -> StatsRange:
    """Apply the defaults and checks shared by every stats endpoint."""
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError, OSError) as exc:
        raise _invalid("tz", "Unknown time zone.") from exc
    last = to_date or datetime.now(zone).date()
    first = from_date or last - timedelta(days=DEFAULT_DAYS)
    if first > last:
        raise _invalid("from", "from must not be after to.")
    if (last - first).days + 1 > MAX_DAYS:
        raise _invalid("from", f"The range can be at most {MAX_DAYS} days.")
    return StatsRange(
        from_date=first,
        to_date=last,
        tz=tz,
        start=datetime.combine(first, time.min, tzinfo=zone),
        end=datetime.combine(last + timedelta(days=1), time.min, tzinfo=zone),
    )


def _rate(successes: int, attempts: int) -> float:
    return round(successes / attempts, 4)


def _in_range(query: Select, rng: StatsRange) -> Select:
    """Non-voided attempts recorded inside the range. The caller adds the owner filter."""
    return query.where(
        Attempt.voided_at.is_(None),
        Attempt.recorded_at >= rng.start,
        Attempt.recorded_at < rng.end,
    )


def _monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def drill_success_rate(
    db: Session, owner: User, drill_id: uuid.UUID, rng: StatsRange, bucket: Bucket
) -> SuccessRateStats:
    drill = db.scalar(select(Drill.id).where(Drill.id == drill_id, Drill.owner_id == owner.id))
    if drill is None:
        raise NotFoundError("Drill")

    bucket_start = cast(func.date_trunc(bucket, func.timezone(rng.tz, Attempt.recorded_at)), Date)
    points_query = _in_range(
        select(
            bucket_start.label("bucket_start"),
            func.count().label("attempts"),
            func.count().filter(Attempt.outcome == "success").label("successes"),
            func.count(distinct(Attempt.drill_run_id)).label("drill_run_count"),
            func.array_agg(distinct(DrillVersion.version_number)).label("version_numbers"),
        )
        .join(
            DrillRun,
            (DrillRun.id == Attempt.drill_run_id) & (DrillRun.owner_id == Attempt.owner_id),
        )
        .join(DrillVersion, DrillVersion.id == DrillRun.drill_version_id)
        .where(Attempt.owner_id == owner.id, DrillRun.drill_id == drill_id)
        .group_by(bucket_start)
        .order_by(bucket_start),
        rng,
    )
    points = [
        SuccessRatePoint(
            bucket_start=row.bucket_start,
            attempts=row.attempts,
            successes=row.successes,
            success_rate=_rate(row.successes, row.attempts),
            drill_run_count=row.drill_run_count,
            drill_version_numbers=sorted(row.version_numbers),
        )
        for row in db.execute(points_query)
    ]

    versions_query = _in_range(
        select(
            DrillVersion.id,
            DrillVersion.version_number,
            func.min(Attempt.recorded_at).label("first_attempt_at"),
        )
        .join(DrillRun, DrillRun.drill_version_id == DrillVersion.id)
        .join(
            Attempt,
            (Attempt.drill_run_id == DrillRun.id) & (Attempt.owner_id == DrillRun.owner_id),
        )
        .where(Attempt.owner_id == owner.id, DrillRun.drill_id == drill_id)
        .group_by(DrillVersion.id, DrillVersion.version_number)
        .order_by(DrillVersion.version_number),
        rng,
    )
    # Every version's scoring kind, so a change is seen even when the version before it had
    # no attempts in the range.
    kinds = {
        row.version_number: row.kind
        for row in db.execute(
            select(
                DrillVersion.version_number, DrillVersion.scoring["kind"].as_string().label("kind")
            ).where(DrillVersion.drill_id == drill_id, DrillVersion.owner_id == owner.id)
        )
    }
    versions = []
    for row in db.execute(versions_query):
        previous = kinds.get(row.version_number - 1)
        versions.append(
            SuccessRateVersion(
                drill_version_id=row.id,
                version_number=row.version_number,
                scoring_kind=kinds[row.version_number],
                first_attempt_at=row.first_attempt_at,
                scoring_kind_changed=previous is not None and previous != kinds[row.version_number],
            )
        )
    return SuccessRateStats(
        drill_id=drill_id,
        bucket=bucket,
        from_date=rng.from_date,
        to_date=rng.to_date,
        points=points,
        versions=versions,
    )


def weekly_volume(db: Session, owner: User, rng: StatsRange) -> WeeklyVolumeStats:
    def week_of(column):  # type: ignore[no-untyped-def]
        return cast(func.date_trunc("week", func.timezone(rng.tz, column)), Date)

    attempt_week = week_of(Attempt.recorded_at)
    attempts = {
        row.week: row.n
        for row in db.execute(
            _in_range(
                select(attempt_week.label("week"), func.count().label("n")).where(
                    Attempt.owner_id == owner.id
                ),
                rng,
            ).group_by(attempt_week)
        )
    }
    run_week = week_of(DrillRun.started_at)
    runs = {
        row.week: row.n
        for row in db.execute(
            select(run_week.label("week"), func.count().label("n"))
            .where(
                DrillRun.owner_id == owner.id,
                DrillRun.started_at >= rng.start,
                DrillRun.started_at < rng.end,
            )
            .group_by(run_week)
        )
    }
    session_week = week_of(PracticeSession.started_at)
    sessions = {
        row.week: row.n
        for row in db.execute(
            select(session_week.label("week"), func.count().label("n"))
            .where(
                PracticeSession.owner_id == owner.id,
                PracticeSession.started_at >= rng.start,
                PracticeSession.started_at < rng.end,
            )
            .group_by(session_week)
        )
    }
    items = []
    week = _monday(rng.from_date)
    while week <= rng.to_date:
        items.append(
            WeeklyVolumeItem(
                week_start=week,
                practice_sessions=sessions.get(week, 0),
                drill_runs=runs.get(week, 0),
                attempts=attempts.get(week, 0),
            )
        )
        week += timedelta(days=7)
    return WeeklyVolumeStats(from_date=rng.from_date, to_date=rng.to_date, items=items)


def tag_breakdown(db: Session, owner: User, rng: StatsRange) -> TagStats:
    attempts = func.count()
    successes = func.count().filter(Attempt.outcome == "success")
    query = _in_range(
        select(
            Tag.id,
            Tag.name,
            Tag.category,
            func.count(distinct(DrillRun.drill_id)).label("drill_count"),
            func.count(distinct(Attempt.drill_run_id)).label("drill_run_count"),
            attempts.label("attempts"),
            successes.label("successes"),
        )
        .join(DrillTag, (DrillTag.tag_id == Tag.id) & (DrillTag.owner_id == Tag.owner_id))
        .join(
            DrillRun, (DrillRun.drill_id == DrillTag.drill_id) & (DrillRun.owner_id == Tag.owner_id)
        )
        .join(
            Attempt,
            (Attempt.drill_run_id == DrillRun.id) & (Attempt.owner_id == DrillRun.owner_id),
        )
        .where(Tag.owner_id == owner.id)
        .group_by(Tag.id, Tag.name, Tag.category)
        .order_by(attempts.desc(), Tag.name),
        rng,
    )
    items = [
        TagStatsItem(
            tag_id=row.id,
            name=row.name,
            category=row.category,
            drill_count=row.drill_count,
            drill_run_count=row.drill_run_count,
            attempts=row.attempts,
            successes=row.successes,
            success_rate=_rate(row.successes, row.attempts),
        )
        for row in db.execute(query)
    ]
    return TagStats(from_date=rng.from_date, to_date=rng.to_date, items=items)
