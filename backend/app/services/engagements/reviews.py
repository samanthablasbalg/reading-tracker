from __future__ import annotations

import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.crud import CRUDBase
from app.exceptions import ConflictError
from app.models.engagement import Engagement
from app.models.enums import ReadingStatus
from app.models.review import Review

review_crud = CRUDBase(Review)


def upsert_review(
    db: Session,
    engagement: Engagement,
    *,
    rating: Decimal | None,
    body: str | None,
) -> Review:
    if engagement.status not in (ReadingStatus.finished, ReadingStatus.dnf):
        raise ConflictError("Can only review a finished or dnf engagement.")

    now = datetime.datetime.now(datetime.UTC)
    if engagement.review is None:
        return review_crud.create(
            db,
            Review(
                engagement_id=engagement.id,
                user_id=engagement.user_id,
                rating=rating,
                body=body,
                written_at=now,
            ),
        )

    engagement.review.rating = rating
    engagement.review.body = body
    engagement.review.written_at = now
    return engagement.review
