from __future__ import annotations

import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.enums import ReadingStatus
from app.models.review import Review
from app.schemas import (
    EngagementEditionCreate,
    EngagementEditionRead,
    EngagementRead,
    ReviewUpsert,
)

from . import lifecycle, progress_logs
from ._shared import reload

router = APIRouter(tags=["engagements"])
router.include_router(lifecycle.router, prefix="/engagements")
router.include_router(progress_logs.router, prefix="/engagements")


@router.post(
    "/engagements/{engagement_id}/editions",
    response_model=EngagementEditionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_binding(
    engagement_id: uuid.UUID,
    payload: EngagementEditionCreate,
    db: Session = Depends(get_db),
) -> EngagementEditionRead:
    engagement = db.get(Engagement, engagement_id)
    if engagement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if payload.edition_id is not None:
        edition = db.get(Edition, payload.edition_id)
        if edition is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    else:
        candidates = (
            db.execute(
                select(Edition).where(
                    Edition.book_id == engagement.book_id,
                    Edition.edition_format == payload.edition_format,
                )
            )
            .scalars()
            .all()
        )
        if len(candidates) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"No {payload.edition_format} edition exists for this book;"
                    " create one first"
                ),
            )
        if len(candidates) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Multiple editions exist for this format; pass edition_id instead"
                ),
            )
        edition = candidates[0]

    if db.get(EngagementEdition, (engagement_id, edition.id)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    binding = EngagementEdition(
        engagement_id=engagement_id,
        edition_id=edition.id,
        user_id=engagement.user_id,
        origin_id=payload.origin_id,
        length_override=payload.length_override,
    )
    db.add(binding)
    db.commit()

    loaded = db.execute(
        select(EngagementEdition)
        .where(
            EngagementEdition.engagement_id == engagement_id,
            EngagementEdition.edition_id == edition.id,
        )
        .options(selectinload(EngagementEdition.edition))
    ).scalar_one()

    return EngagementEditionRead.model_validate(loaded)


@router.get(
    "/engagements/{engagement_id}/editions", response_model=list[EngagementEditionRead]
)
def list_bindings(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[EngagementEditionRead]:
    if db.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    bindings = (
        db.execute(
            select(EngagementEdition)
            .where(EngagementEdition.engagement_id == engagement_id)
            .options(selectinload(EngagementEdition.edition))
        )
        .scalars()
        .all()
    )
    return [EngagementEditionRead.model_validate(b) for b in bindings]


@router.delete(
    "/engagements/{engagement_id}/editions/{edition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_binding(
    engagement_id: uuid.UUID,
    edition_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    binding = db.get(EngagementEdition, (engagement_id, edition_id))
    if binding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    db.delete(binding)
    db.commit()


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
