import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class Credentials(BaseModel):
    """Email and password for sign up and sign in. The password is a SecretStr, so it never
    shows in a repr, a log line or an error."""

    email: Annotated[str, Field(min_length=3, max_length=254)]
    password: Annotated[SecretStr, Field(min_length=8, max_length=128)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        local, _, domain = email.partition("@")
        if not local or "." not in domain or " " in email or "@" in domain:
            raise ValueError("Enter a valid email address.")
        return email


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime
