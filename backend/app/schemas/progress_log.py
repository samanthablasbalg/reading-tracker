from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import LogUnit


class ProgressLogCreate(BaseModel):
    current_page: int | None = Field(default=None, gt=0)
    current_minute: int | None = Field(default=None, gt=0)
    audio_length_minutes: int | None = Field(default=None, gt=0)
    logged_on: datetime.date | None = None


class ProgressLogUpdate(BaseModel):
    logged_on: datetime.date | None = None
    page_end: int | None = Field(default=None, gt=0)
    minute_end: int | None = Field(default=None, gt=0)


class ProgressLogRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    logged_on: datetime.date
    unit: LogUnit
    page_start: int | None
    page_end: int | None
    minute_start: int | None
    minute_end: int | None
    new_ground: bool

    model_config = ConfigDict(from_attributes=True)
