from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(extra="ignore")

    database_url: str
    test_database_url: str | None = None
    # A practice session with no attempts for this long is closed when it is next loaded.
    session_idle_hours: int = Field(default=6, ge=1)


@lru_cache
def get_settings() -> Settings:
    return Settings()
