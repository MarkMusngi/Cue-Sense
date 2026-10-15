import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

TagCategory = Literal["skill", "custom"]
TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class TagCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: TagName
    category: TagCategory = "custom"


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: TagCategory
    created_at: datetime
