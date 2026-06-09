from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.book import BookAuthor
    from app.models.standalone_entry import StandaloneEntry


class Author(TimestampMixin, Base):
    __tablename__ = "authors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str]
    nationality: Mapped[str | None]
    gender_identity: Mapped[str | None]
    bipoc: Mapped[bool] = mapped_column(default=False)
    lgbt: Mapped[bool] = mapped_column(default=False)
    other_attributes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    google_books_id: Mapped[str | None]

    book_authors: Mapped[list[BookAuthor]] = relationship(back_populates="author")
    standalone_entries: Mapped[list[StandaloneEntry]] = relationship(
        back_populates="author"
    )
