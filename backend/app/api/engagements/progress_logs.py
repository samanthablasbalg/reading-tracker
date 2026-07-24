from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import engagement_crud
from app.database import get_db
from app.exceptions import NotFoundError
from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog
from app.schemas import (
    ProgressLogCreate,
    ProgressLogRead,
    ProgressLogUpdate,
    progress_log_read,
)
from app.services.engagements import progress_logs as progress_log_service

router = APIRouter()


def _find_log(engagement: Engagement, log_id: uuid.UUID) -> ProgressLog:
    log = next(
        (entry for entry in engagement.progress_logs if entry.id == log_id), None
    )
    if log is None:
        raise NotFoundError("Progress log not found")
    return log


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
    engagement = engagement_crud.get_or_raise(db, engagement_id)
    log = progress_log_service.log_progress(
        db,
        engagement,
        current_page=payload.current_page,
        current_minute=payload.current_minute,
        logged_on=payload.logged_on,
        audio_length_minutes=payload.audio_length_minutes,
    )
    db.commit()
    db.refresh(log)
    return progress_log_read(log)


@router.get("/{engagement_id}/progress-logs", response_model=list[ProgressLogRead])
def list_progress_logs(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[ProgressLogRead]:
    engagement_crud.get_or_raise(db, engagement_id)
    logs = (
        db.execute(
            select(ProgressLog)
            .where(ProgressLog.engagement_id == engagement_id)
            .order_by(ProgressLog.logged_on.asc(), ProgressLog.created_at.asc())
        )
        .scalars()
        .all()
    )
    return [progress_log_read(log) for log in logs]


@router.patch(
    "/{engagement_id}/progress-logs/{log_id}",
    response_model=ProgressLogRead,
)
def update_progress_log(
    engagement_id: uuid.UUID,
    log_id: uuid.UUID,
    payload: ProgressLogUpdate,
    db: Session = Depends(get_db),
) -> ProgressLogRead:
    engagement = engagement_crud.get_or_raise(db, engagement_id)
    log = _find_log(engagement, log_id)
    progress_log_service.update_progress_log(
        engagement,
        log,
        logged_on=payload.logged_on,
        page_end=payload.page_end,
        minute_end=payload.minute_end,
    )
    db.commit()
    db.refresh(log)
    return progress_log_read(log)


@router.delete(
    "/{engagement_id}/progress-logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_progress_log(
    engagement_id: uuid.UUID,
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    engagement = engagement_crud.get_or_raise(db, engagement_id)
    log = _find_log(engagement, log_id)
    progress_log_service.delete_progress_log(db, engagement, log)
    db.commit()
