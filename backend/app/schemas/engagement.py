from __future__ import annotations

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.enums import Format, ReadingStatus
from app.schemas.book import BookRead


class EngagementCreate(BaseModel):
    book_id: uuid.UUID
    edition_format: Format


class EngagementStatusUpdate(BaseModel):
    status: Literal["reading", "finished", "dnf"]


class EngagementRead(BaseModel):
    id: uuid.UUID
    book: BookRead
    formats: list[Format]
    cover_url: str | None
    status: ReadingStatus
    started_on: datetime.date | None
    finished_on: datetime.date | None
    abandoned_on: datetime.date | None
    resume_from_page: int
    completion_pct: int | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
