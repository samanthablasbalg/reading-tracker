from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    DatePrecision,
    ReadingFormat,
    ReadingStatus,
    date_precision_type,
)
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.book_source import BookSource
    from app.models.edition import EngagementEdition
    from app.models.progress_log import ProgressLog
    from app.models.review import Review


class Engagement(TimestampMixin, Base):
    __tablename__ = "engagements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id"))
    status: Mapped[ReadingStatus] = mapped_column(
        SAEnum(ReadingStatus, name="reading_status")
    )
    formats: Mapped[list[ReadingFormat]] = mapped_column(
        ARRAY(SAEnum(ReadingFormat, name="reading_format")), default=list
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("book_sources.id"))
    isbn: Mapped[str | None]
    cover_url: Mapped[str | None]
    custom_page_count: Mapped[int | None]
    custom_audio_minutes: Mapped[int | None]

    interested_on: Mapped[datetime.date | None]
    interested_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )
    tbr_added_on: Mapped[datetime.date | None]
    tbr_added_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )
    acquired_on: Mapped[datetime.date | None]
    acquired_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )
    started_on: Mapped[datetime.date | None]
    started_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )
    finished_on: Mapped[datetime.date | None]
    finished_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )

    book: Mapped[Book] = relationship(back_populates="engagements")
    source: Mapped[BookSource | None] = relationship(back_populates="engagements")
    progress_logs: Mapped[list[ProgressLog]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
    engagement_editions: Mapped[list[EngagementEdition]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
    review: Mapped[Review | None] = relationship(
        back_populates="engagement", uselist=False
    )

    @property
    def resume_from_page(self) -> int:
        if not self.progress_logs:
            return 0
        latest = max(self.progress_logs, key=lambda log: log.logged_at)
        return latest.page_end if latest.page_end is not None else 0

    @property
    def completion_pct(self) -> int | None:
        if not self.progress_logs or not self.book.default_page_count:
            return None
        latest = max(self.progress_logs, key=lambda log: log.logged_at)
        if latest.page_end is None:
            return None
        return max(
            0, min(100, round(latest.page_end / self.book.default_page_count * 100))
        )
