from __future__ import annotations

import datetime
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.book import Book, BookAuthor
from app.models.engagement import Engagement
from app.models.enums import LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.schemas.engagement import (
    EngagementCreate,
    EngagementRead,
    EngagementStatusUpdate,
)
from app.schemas.progress_log import ProgressLogCreate, ProgressLogRead

router = APIRouter(prefix="/engagements", tags=["engagements"])

_LOAD_OPTIONS = (
    selectinload(Engagement.book)
    .selectinload(Book.book_authors)
    .selectinload(BookAuthor.author),
    selectinload(Engagement.progress_logs),
)


def _fetch(engagement_id: uuid.UUID, db: Session) -> Engagement:
    engagement = db.execute(
        select(Engagement).where(Engagement.id == engagement_id).options(*_LOAD_OPTIONS)
    ).scalar_one_or_none()
    if engagement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return engagement


@router.post("", response_model=EngagementRead, status_code=status.HTTP_201_CREATED)
def create_engagement(
    payload: EngagementCreate, db: Session = Depends(get_db)
) -> EngagementRead:
    book = db.get(Book, payload.book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    duplicate = db.execute(
        select(Engagement).where(
            Engagement.book_id == payload.book_id,
            Engagement.status == ReadingStatus.reading,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    engagement = Engagement(
        book_id=payload.book_id,
        status=ReadingStatus.reading,
        started_on=datetime.date.today(),
        cover_url=book.default_cover_url,
    )
    db.add(engagement)
    db.commit()

    return EngagementRead.model_validate(_fetch(engagement.id, db))


@router.patch("/{engagement_id}", response_model=EngagementRead)
def update_engagement_status(
    engagement_id: uuid.UUID,
    payload: EngagementStatusUpdate,
    db: Session = Depends(get_db),
) -> EngagementRead:
    engagement = _fetch(engagement_id, db)

    new_status = ReadingStatus(payload.status)

    if new_status == engagement.status:
        return EngagementRead.model_validate(engagement)

    if new_status == ReadingStatus.reading:
        duplicate = db.execute(
            select(Engagement).where(
                Engagement.book_id == engagement.book_id,
                Engagement.status == ReadingStatus.reading,
                Engagement.id != engagement_id,
            )
        ).scalar_one_or_none()
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    engagement.status = new_status
    if new_status == ReadingStatus.finished:
        engagement.finished_on = datetime.date.today()
    elif new_status == ReadingStatus.reading:
        engagement.finished_on = None

    db.commit()

    return EngagementRead.model_validate(_fetch(engagement_id, db))


@router.post(
    "/{engagement_id}/progress-logs",
    response_model=ProgressLogRead,
    status_code=status.HTTP_201_CREATED,
)
def log_progress(
    engagement_id: uuid.UUID,
    payload: ProgressLogCreate,
    db: Session = Depends(get_db),
) -> ProgressLogRead:
    engagement = _fetch(engagement_id, db)

    if engagement.status != ReadingStatus.reading:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    page_start = engagement.resume_from_page
    if payload.current_page <= page_start:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    log = ProgressLog(
        engagement_id=engagement_id,
        logged_at=datetime.datetime.now(datetime.UTC),
        unit=LogUnit.pages,
        page_start=page_start,
        page_end=payload.current_page,
        new_ground=True,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return ProgressLogRead.model_validate(log)


@router.get("", response_model=list[EngagementRead])
def list_engagements(
    status_filter: Literal["reading", "finished"] = Query(..., alias="status"),
    db: Session = Depends(get_db),
) -> list[EngagementRead]:
    engagements = (
        db.execute(
            select(Engagement)
            .where(Engagement.status == status_filter)
            .options(*_LOAD_OPTIONS)
        )
        .scalars()
        .all()
    )
    return [EngagementRead.model_validate(e) for e in engagements]
