from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    DatePrecision,
    Format,
    ReadingStatus,
    date_precision_type,
)
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.book import Book
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
    abandoned_on: Mapped[datetime.date | None]
    abandoned_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )

    book: Mapped[Book] = relationship(back_populates="engagements")
    progress_logs: Mapped[list[ProgressLog]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
    engagement_editions: Mapped[list[EngagementEdition]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
    review: Mapped[Review | None] = relationship(
        back_populates="engagement", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def formats(self) -> list[Format]:
        return [ee.edition.edition_format for ee in self.engagement_editions]

    @property
    def cover_url(self) -> str | None:
        for ee in self.engagement_editions:
            if ee.edition.cover_url:
                return ee.edition.cover_url
        return self.book.default_cover_url

    def _latest_page_end(self) -> int | None:
        page_logs = [log for log in self.progress_logs if log.page_end is not None]
        if not page_logs:
            return None
        return max(page_logs, key=lambda log: (log.logged_on, log.created_at)).page_end

    @property
    def resume_from_page(self) -> int:
        end = self._latest_page_end()
        return end if end is not None else 0

    def _latest_minute_end(self) -> int | None:
        minute_logs = [log for log in self.progress_logs if log.minute_end is not None]
        if not minute_logs:
            return None
        return max(
            minute_logs, key=lambda log: (log.logged_on, log.created_at)
        ).minute_end

    @property
    def resume_from_minute(self) -> int:
        end = self._latest_minute_end()
        return end if end is not None else 0

    def _resolve_length(self, fmt: Format) -> int | None:
        for ee in self.engagement_editions:
            if ee.edition.edition_format == fmt:
                if ee.length_override is not None:
                    return ee.length_override
                candidate = (
                    ee.edition.audio_minutes
                    if fmt == Format.audio
                    else ee.edition.page_count
                )
                if candidate is not None:
                    return candidate
        if fmt == Format.audio:
            return self.book.default_audio_minutes
        return self.book.default_page_count

    @property
    def completion_pct(self) -> int | None:
        if not self.progress_logs:
            return None
        if Format.audio in self.formats:
            position = self._latest_minute_end()
            if position is None:
                return None
            denominator = self._resolve_length(Format.audio)
        else:
            position = self._latest_page_end()
            if position is None:
                return None
            fmt = next((f for f in self.formats if f != Format.audio), Format.print)
            denominator = self._resolve_length(fmt)
        if not denominator:
            return None
        return max(0, min(100, round(position / denominator * 100)))
