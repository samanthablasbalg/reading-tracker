from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import LogUnit


class ProgressLogCreate(BaseModel):
    current_page: int = Field(gt=0)


class ProgressLogRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    logged_at: datetime.datetime
    unit: LogUnit
    page_start: int | None
    page_end: int | None
    new_ground: bool

    model_config = ConfigDict(from_attributes=True)
