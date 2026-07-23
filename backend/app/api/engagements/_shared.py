from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models.book import Book, BookAuthor
from app.models.edition import EngagementEdition
from app.models.engagement import Engagement
from app.services.engagements.lifecycle import engagement_crud

ENGAGEMENT_READ_OPTIONS = (
    selectinload(Engagement.book)
    .selectinload(Book.book_authors)
    .selectinload(BookAuthor.author),
    selectinload(Engagement.progress_logs),
    selectinload(Engagement.engagement_editions).selectinload(
        EngagementEdition.edition
    ),
    selectinload(Engagement.review),
)


def reload(db: Session, engagement_id: uuid.UUID) -> Engagement:
    return engagement_crud.get_or_raise(
        db, engagement_id, options=ENGAGEMENT_READ_OPTIONS
    )
