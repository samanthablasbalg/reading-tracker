from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import BookAuthorRole, DatePrecision
from app.models.mixins import TimestampMixin

_date_precision = SAEnum(DatePrecision, name="date_precision")

if TYPE_CHECKING:
    from app.models.author import Author
    from app.models.engagement import Engagement
    from app.models.standalone_entry import StandaloneEntry


class Book(TimestampMixin, Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str]
    google_books_id: Mapped[str | None]
    default_cover_url: Mapped[str | None]
    default_page_count: Mapped[int | None]
    default_audio_minutes: Mapped[int | None]
    original_language: Mapped[str | None]
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    series: Mapped[str | None]
    series_position: Mapped[int | None]
    publication_date: Mapped[datetime.date | None]
    publication_date_precision: Mapped[DatePrecision] = mapped_column(
        _date_precision, default=DatePrecision.day
    )

    book_authors: Mapped[list[BookAuthor]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    engagements: Mapped[list[Engagement]] = relationship(back_populates="book")
    standalone_entries: Mapped[list[StandaloneEntry]] = relationship(
        back_populates="book"
    )


class BookAuthor(Base):
    __tablename__ = "book_authors"

    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id"), primary_key=True)
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("authors.id"), primary_key=True
    )
    role: Mapped[BookAuthorRole] = mapped_column(
        SAEnum(BookAuthorRole, name="book_author_role"), primary_key=True
    )

    book: Mapped[Book] = relationship(back_populates="book_authors")
    author: Mapped[Author] = relationship(back_populates="book_authors")
