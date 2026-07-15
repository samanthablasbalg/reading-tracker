from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import DatePrecision, date_precision_type
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.author import Author
    from app.models.book import Book
    from app.models.user import User


class StandaloneEntry(TimestampMixin, Base):
    __tablename__ = "standalone_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("books.id"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("authors.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    manual_title: Mapped[str | None]
    manual_author: Mapped[str | None]
    read_on: Mapped[datetime.date]
    read_on_precision: Mapped[DatePrecision] = mapped_column(
        date_precision_type, default=DatePrecision.day
    )
    pages_read: Mapped[int | None]
    minutes_listened: Mapped[int | None]
    notes: Mapped[str | None] = mapped_column(Text)

    book: Mapped[Book | None] = relationship(back_populates="standalone_entries")
    author: Mapped[Author | None] = relationship(back_populates="standalone_entries")
    user: Mapped[User] = relationship(back_populates="standalone_entries")
