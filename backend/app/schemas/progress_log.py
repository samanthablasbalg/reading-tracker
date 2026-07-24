from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.models.progress_log import ProgressLog


class ProgressLogCreate(BaseModel):
    current_page: int | None = Field(default=None, gt=0)
    current_minute: int | None = Field(default=None, gt=0)
    audio_length_minutes: int | None = Field(default=None, gt=0)
    logged_on: datetime.date | None = None


class ProgressLogUpdate(BaseModel):
    logged_on: datetime.date | None = None
    page_end: int | None = Field(default=None, gt=0)
    minute_end: int | None = Field(default=None, gt=0)


class _ProgressLogReadBase(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    logged_on: datetime.date
    new_ground: bool


class PageProgressLogRead(_ProgressLogReadBase):
    type: Literal["page"] = "page"
    page_start: int
    page_end: int


class MinuteProgressLogRead(_ProgressLogReadBase):
    type: Literal["minute"] = "minute"
    minute_start: int
    minute_end: int


ProgressLogRead = Annotated[
    PageProgressLogRead | MinuteProgressLogRead, Field(discriminator="type")
]


def progress_log_read(
    log: ProgressLog,
) -> PageProgressLogRead | MinuteProgressLogRead:
    """Builds the discriminated read schema from an ORM `ProgressLog` row.

    The row itself stores `unit` (page/minute) plus both start/end column pairs,
    one of which is always null — that's the storage shape, not the API shape.
    This picks the matching variant so the OpenAPI schema (and the orval client
    generated from it) exposes a real `type`-discriminated union instead of one
    flat, all-nullable object.
    """
    if log.unit == "pages":
        # `unit == "pages"` is set only when page_start/page_end were populated
        # (see log_progress in services/engagements/progress_logs.py) — the
        # asserts narrow for mypy, not a runtime check of new information.
        assert log.page_start is not None
        assert log.page_end is not None
        return PageProgressLogRead(
            id=log.id,
            engagement_id=log.engagement_id,
            logged_on=log.logged_on,
            new_ground=log.new_ground,
            page_start=log.page_start,
            page_end=log.page_end,
        )
    assert log.minute_start is not None
    assert log.minute_end is not None
    return MinuteProgressLogRead(
        id=log.id,
        engagement_id=log.engagement_id,
        logged_on=log.logged_on,
        new_ground=log.new_ground,
        minute_start=log.minute_start,
        minute_end=log.minute_end,
    )
