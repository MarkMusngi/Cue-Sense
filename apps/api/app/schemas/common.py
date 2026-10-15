from typing import Annotated

from pydantic import BaseModel, Field


class Pagination(BaseModel):
    """limit and offset query parameters, shared by every list endpoint."""

    limit: Annotated[int, Field(ge=1, le=100)] = 20
    offset: Annotated[int, Field(ge=0)] = 0


class Page[ItemT](BaseModel):
    items: list[ItemT]
    total: int
    limit: int
    offset: int
