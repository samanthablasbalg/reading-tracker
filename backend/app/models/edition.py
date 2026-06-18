from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ReadingFormat
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.book_source import BookSource
    from app.models.engagement import Engagement


class Edition(TimestampMixin, Base):
    __tablename__ = "editions"
    __table_args__ = (
        Index(
            "ix_editions_book_format_generic",
            "book_id",
            "edition_format",
            unique=True,
            postgresql_where=text("isbn IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id"))
    edition_format: Mapped[ReadingFormat] = mapped_column(
        SAEnum(ReadingFormat, name="edition_format")
    )
    isbn: Mapped[str | None]
    page_count: Mapped[int | None]
    cover_url: Mapped[str | None]

    book: Mapped[Book] = relationship(back_populates="editions")
    engagement_editions: Mapped[list[EngagementEdition]] = relationship(
        back_populates="edition", cascade="all, delete-orphan"
    )


class EngagementEdition(Base):
    __tablename__ = "engagement_editions"

    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id"), primary_key=True
    )
    edition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("editions.id"), primary_key=True
    )
    origin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("book_sources.id"))
    length_override: Mapped[int | None]

    edition: Mapped[Edition] = relationship(back_populates="engagement_editions")
    engagement: Mapped[Engagement] = relationship(back_populates="engagement_editions")
    origin: Mapped[BookSource | None] = relationship()
