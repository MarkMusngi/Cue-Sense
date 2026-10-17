import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser
from app.db.session import DbSession
from app.schemas.stats import Bucket, SuccessRateStats, TagStats, WeeklyVolumeStats
from app.services import stats_service
from app.services.stats_service import StatsRange


def stats_range(
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
    tz: Annotated[str, Query()] = "UTC",
) -> StatsRange:
    return stats_service.resolve_range(from_date, to_date, tz)


RangeParams = Annotated[StatsRange, Depends(stats_range)]

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/drills/{drill_id}/success-rate")
def drill_success_rate(
    drill_id: uuid.UUID,
    rng: RangeParams,
    db: DbSession,
    user: CurrentUser,
    bucket: Annotated[Bucket, Query()] = "week",
) -> SuccessRateStats:
    return stats_service.drill_success_rate(db, user, drill_id, rng, bucket)


@router.get("/weekly-volume")
def weekly_volume(rng: RangeParams, db: DbSession, user: CurrentUser) -> WeeklyVolumeStats:
    return stats_service.weekly_volume(db, user, rng)


@router.get("/tags")
def tag_breakdown(rng: RangeParams, db: DbSession, user: CurrentUser) -> TagStats:
    return stats_service.tag_breakdown(db, user, rng)
