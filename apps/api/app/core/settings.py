from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(extra="ignore")

    database_url: str
    test_database_url: str | None = None
    # A practice session with no attempts for this long is closed when it is next loaded.
    session_idle_hours: int = Field(default=6, ge=1)
    # How long a sign-in lasts, and whether its cookie is marked Secure (true behind https).
    session_ttl_hours: int = Field(default=720, ge=1)
    session_cookie_secure: bool = True
    # Password the seed gives the dev user. Local development and tests only.
    dev_user_password: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
