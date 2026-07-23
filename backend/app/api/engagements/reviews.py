from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EngagementRead, ReviewUpsert
from app.services.engagements import reviews as reviews_service

from ._shared import reload

router = APIRouter()


@router.put("/{engagement_id}/review", response_model=EngagementRead)
def upsert_review(
    engagement_id: uuid.UUID,
    payload: ReviewUpsert,
    db: Session = Depends(get_db),
) -> EngagementRead:
    engagement = reload(db, engagement_id)
    reviews_service.upsert_review(
        db, engagement, rating=payload.rating, body=payload.body
    )
    db.commit()
    return EngagementRead.model_validate(reload(db, engagement_id))
