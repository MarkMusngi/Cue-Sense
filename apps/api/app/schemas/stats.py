"""Response shapes for the /stats endpoints (docs/stats-contract.md)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Bucket = Literal["day", "week"]


class SuccessRatePoint(BaseModel):
    bucket_start: date
    attempts: int
    successes: int
    success_rate: float
    drill_run_count: int
    drill_version_numbers: list[int]


class SuccessRateVersion(BaseModel):
    drill_version_id: uuid.UUID
    version_number: int
    scoring_kind: str
    first_attempt_at: datetime
    scoring_kind_changed: bool


class SuccessRateStats(BaseModel):
    drill_id: uuid.UUID
    bucket: Bucket
    # Serialised as "from" and "to" (from is a Python keyword).
    from_date: date = Field(serialization_alias="from")
    to_date: date = Field(serialization_alias="to")
    points: list[SuccessRatePoint]
    versions: list[SuccessRateVersion]


class WeeklyVolumeItem(BaseModel):
    week_start: date
    practice_sessions: int
    drill_runs: int
    attempts: int


class WeeklyVolumeStats(BaseModel):
    from_date: date = Field(serialization_alias="from")
    to_date: date = Field(serialization_alias="to")
    items: list[WeeklyVolumeItem]


class TagStatsItem(BaseModel):
    tag_id: uuid.UUID
    name: str
    category: str
    drill_count: int
    drill_run_count: int
    attempts: int
    successes: int
    success_rate: float


class TagStats(BaseModel):
    from_date: date = Field(serialization_alias="from")
    to_date: date = Field(serialization_alias="to")
    items: list[TagStatsItem]
