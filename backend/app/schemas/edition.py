from __future__ import annotations

import datetime
import uuid
from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import ReadingFormat


class EditionCreate(BaseModel):
    book_id: uuid.UUID
    edition_format: ReadingFormat
    isbn: str | None = None
    page_count: int | None = None
    cover_url: str | None = None


class EditionUpdate(BaseModel):
    isbn: str | None = None
    page_count: int | None = None
    cover_url: str | None = None


class EditionRead(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    edition_format: ReadingFormat
    isbn: str | None
    page_count: int | None
    cover_url: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class EngagementEditionCreate(BaseModel):
    edition_id: uuid.UUID | None = None
    edition_format: ReadingFormat | None = None
    origin_id: uuid.UUID | None = None
    length_override: int | None = None

    @model_validator(mode="after")
    def check_exactly_one_resolver(self) -> Self:
        has_id = self.edition_id is not None
        has_format = self.edition_format is not None
        if has_id == has_format:
            raise ValueError("Provide exactly one of edition_id or edition_format")
        return self


class EngagementEditionRead(BaseModel):
    edition: EditionRead
    origin_id: uuid.UUID | None
    length_override: int | None

    model_config = ConfigDict(from_attributes=True)
