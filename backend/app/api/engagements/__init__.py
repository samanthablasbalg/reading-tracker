from __future__ import annotations

import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import ReadingStatus
from app.models.review import Review
from app.schemas import EngagementRead, ReviewUpsert

from . import bindings, lifecycle, progress_logs
from ._shared import reload

router = APIRouter(tags=["engagements"])
router.include_router(lifecycle.router, prefix="/engagements")
router.include_router(progress_logs.router, prefix="/engagements")
router.include_router(bindings.router, prefix="/engagements")


@router.put("/engagements/{engagement_id}/review", response_model=EngagementRead)
def upsert_review(
    engagement_id: uuid.UUID,
    payload: ReviewUpsert,
    db: Session = Depends(get_db),
) -> EngagementRead:
    engagement = reload(db, engagement_id)

    if engagement.status not in (ReadingStatus.finished, ReadingStatus.dnf):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    now = datetime.datetime.now(datetime.UTC)
    if engagement.review is None:
        db.add(
            Review(
                engagement_id=engagement.id,
                user_id=engagement.user_id,
                rating=payload.rating,
                body=payload.body,
                written_at=now,
            )
        )
    else:
        engagement.review.rating = payload.rating
        engagement.review.body = payload.body
        engagement.review.written_at = now

    db.commit()
    return EngagementRead.model_validate(reload(db, engagement_id))
