from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import DatePrecision
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.author import Author
    from app.models.book import Book

_date_precision = SAEnum(DatePrecision, name="date_precision")


class StandaloneEntry(TimestampMixin, Base):
    __tablename__ = "standalone_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("books.id"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("authors.id"))
    manual_title: Mapped[str | None]
    manual_author: Mapped[str | None]
    read_on: Mapped[datetime.date]
    read_on_precision: Mapped[DatePrecision] = mapped_column(
        _date_precision, default=DatePrecision.day
    )
    pages_read: Mapped[int | None]
    minutes_listened: Mapped[int | None]
    notes: Mapped[str | None] = mapped_column(Text)

    book: Mapped[Book | None] = relationship(back_populates="standalone_entries")
    author: Mapped[Author | None] = relationship(back_populates="standalone_entries")
