from __future__ import annotations

import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.book import Book, BookAuthor
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.enums import Format, LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.models.review import Review
from app.schemas.edition import EngagementEditionCreate, EngagementEditionRead
from app.schemas.engagement import (
    EngagementCreate,
    EngagementRead,
    EngagementStatusUpdate,
)
from app.schemas.progress_log import (
    ProgressLogCreate,
    ProgressLogRead,
    ProgressLogUpdate,
)
from app.schemas.review import ReviewUpsert

router = APIRouter(prefix="/engagements", tags=["engagements"])

_LOAD_OPTIONS = (
    selectinload(Engagement.book)
    .selectinload(Book.book_authors)
    .selectinload(BookAuthor.author),
    selectinload(Engagement.progress_logs),
    selectinload(Engagement.engagement_editions).selectinload(
        EngagementEdition.edition
    ),
    selectinload(Engagement.review),
)


def _capture_audio_length(book: Book, edition: Edition, length: int) -> None:
    if book.default_audio_minutes is None:
        book.default_audio_minutes = length
    if edition.audio_minutes is None:
        edition.audio_minutes = length


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
        select(Engagement)
        .join(EngagementEdition)
        .join(Edition)
        .where(
            Engagement.book_id == payload.book_id,
            Engagement.status == ReadingStatus.reading,
            Edition.edition_format == payload.edition_format,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    engagement = Engagement(
        book_id=payload.book_id,
        status=ReadingStatus.reading,
        started_on=datetime.date.today(),
    )
    db.add(engagement)
    db.flush()

    candidates = (
        db.execute(
            select(Edition).where(
                Edition.book_id == payload.book_id,
                Edition.edition_format == payload.edition_format,
            )
        )
        .scalars()
        .all()
    )
    if len(candidates) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {payload.edition_format} edition exists for this book",
        )
    if len(candidates) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This book has more than one {payload.edition_format} edition, so"
                " the app can't tell which one to start reading. Choosing a specific"
                " edition when starting a read isn't supported yet."
            ),
        )
    edition = candidates[0]
    db.add(EngagementEdition(engagement_id=engagement.id, edition_id=edition.id))

    if payload.audio_length_minutes is not None:
        _capture_audio_length(book, edition, payload.audio_length_minutes)

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
    match new_status:
        case ReadingStatus.reading:
            engagement.finished_on = None
            engagement.abandoned_on = None
        case ReadingStatus.finished:
            engagement.finished_on = datetime.date.today()
            if Format.audio not in engagement.formats:
                page_count = engagement.book.default_page_count
                if page_count is not None and engagement.resume_from_page != page_count:
                    db.add(
                        ProgressLog(
                            engagement_id=engagement.id,
                            logged_at=datetime.datetime.now(datetime.UTC),
                            unit=LogUnit.pages,
                            page_start=engagement.resume_from_page,
                            page_end=page_count,
                            new_ground=True,
                        )
                    )
            else:
                audio_length = engagement._resolve_length(Format.audio)
                if (
                    audio_length is not None
                    and engagement.resume_from_minute != audio_length
                ):
                    db.add(
                        ProgressLog(
                            engagement_id=engagement.id,
                            logged_at=datetime.datetime.now(datetime.UTC),
                            unit=LogUnit.minutes,
                            minute_start=engagement.resume_from_minute,
                            minute_end=audio_length,
                            new_ground=True,
                        )
                    )
        case ReadingStatus.dnf:
            if engagement.progress_logs:
                latest = max(engagement.progress_logs, key=lambda log: log.logged_at)
                engagement.abandoned_on = latest.logged_at.astimezone(
                    datetime.UTC
                ).date()
            else:
                engagement.abandoned_on = datetime.date.today()

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

    is_audio = Format.audio in engagement.formats
    unit = LogUnit.minutes if is_audio else LogUnit.pages
    position = payload.current_minute if is_audio else payload.current_page
    resume = engagement.resume_from_minute if is_audio else engagement.resume_from_page

    if position is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT)
    if position <= resume:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    log = ProgressLog(
        engagement_id=engagement_id,
        logged_at=datetime.datetime.now(datetime.UTC),
        unit=unit,
        minute_start=resume if is_audio else None,
        minute_end=position if is_audio else None,
        page_start=None if is_audio else resume,
        page_end=None if is_audio else position,
        new_ground=True,
    )
    db.add(log)

    if is_audio and payload.audio_length_minutes is not None:
        audio_ee = next(
            (
                ee
                for ee in engagement.engagement_editions
                if ee.edition.edition_format == Format.audio
            ),
            None,
        )
        if audio_ee is not None:
            _capture_audio_length(
                engagement.book, audio_ee.edition, payload.audio_length_minutes
            )

    db.commit()
    db.refresh(log)

    return ProgressLogRead.model_validate(log)


@router.post(
    "/{engagement_id}/editions",
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


@router.get("/{engagement_id}/editions", response_model=list[EngagementEditionRead])
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
    "/{engagement_id}/editions/{edition_id}",
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


@router.get("/{engagement_id}/progress-logs", response_model=list[ProgressLogRead])
def list_progress_logs(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[ProgressLogRead]:
    if db.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    logs = (
        db.execute(
            select(ProgressLog)
            .where(ProgressLog.engagement_id == engagement_id)
            .order_by(ProgressLog.logged_at.asc())
        )
        .scalars()
        .all()
    )
    return [ProgressLogRead.model_validate(log) for log in logs]


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
    engagement = _fetch(engagement_id, db)

    log = next(
        (entry for entry in engagement.progress_logs if entry.id == log_id),
        None,
    )
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    sorted_logs = sorted(engagement.progress_logs, key=lambda entry: entry.logged_at)
    idx = sorted_logs.index(log)
    prev_log = sorted_logs[idx - 1] if idx > 0 else None
    next_log = sorted_logs[idx + 1] if idx < len(sorted_logs) - 1 else None

    if payload.logged_at is not None:
        new_date = payload.logged_at
        if (
            prev_log is not None
            and new_date < prev_log.logged_at.astimezone(datetime.UTC).date()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That date would move this entry before the previous one.",
            )
        if (
            next_log is not None
            and new_date > next_log.logged_at.astimezone(datetime.UTC).date()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That date would move this entry after the next one.",
            )
        original = log.logged_at.astimezone(datetime.UTC)
        log.logged_at = datetime.datetime(
            new_date.year,
            new_date.month,
            new_date.day,
            original.hour,
            original.minute,
            original.second,
            tzinfo=datetime.UTC,
        )

    editing_progress = payload.page_end is not None or payload.minute_end is not None
    if editing_progress and log.id != sorted_logs[-1].id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only the most recent entry's progress can be edited.",
        )

    if payload.page_end is not None:
        if payload.page_end <= (log.page_start or 0):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Page must be higher than this session's starting page.",
            )
        log.page_end = payload.page_end

    if payload.minute_end is not None:
        if payload.minute_end <= (log.minute_start or 0):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Minute must be higher than this session's starting minute.",
            )
        log.minute_end = payload.minute_end

    db.commit()
    db.refresh(log)
    return ProgressLogRead.model_validate(log)


@router.get("/{engagement_id}", response_model=EngagementRead)
def get_engagement(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> EngagementRead:
    return EngagementRead.model_validate(_fetch(engagement_id, db))


@router.put("/{engagement_id}/review", response_model=EngagementRead)
def upsert_review(
    engagement_id: uuid.UUID,
    payload: ReviewUpsert,
    db: Session = Depends(get_db),
) -> EngagementRead:
    engagement = _fetch(engagement_id, db)

    if engagement.status not in (ReadingStatus.finished, ReadingStatus.dnf):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)

    now = datetime.datetime.now(datetime.UTC)
    if engagement.review is None:
        db.add(
            Review(
                engagement_id=engagement.id,
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
    return EngagementRead.model_validate(_fetch(engagement_id, db))


@router.get("", response_model=list[EngagementRead])
def list_engagements(
    status: ReadingStatus = Query(..., alias="status"),
    db: Session = Depends(get_db),
) -> list[EngagementRead]:
    latest_log_sq = (
        select(
            ProgressLog.engagement_id,
            func.max(ProgressLog.logged_at).label("max_logged_at"),
        )
        .group_by(ProgressLog.engagement_id)
        .subquery()
    )
    order_key = {
        ReadingStatus.reading: func.greatest(
            Engagement.updated_at, latest_log_sq.c.max_logged_at
        ),
        ReadingStatus.finished: Engagement.finished_on,
        ReadingStatus.dnf: Engagement.abandoned_on,
    }[status]
    engagements = (
        db.execute(
            select(Engagement)
            .where(Engagement.status == status)
            .outerjoin(latest_log_sq, Engagement.id == latest_log_sq.c.engagement_id)
            .order_by(order_key.desc(), Engagement.id.asc())
            .options(*_LOAD_OPTIONS)
        )
        .scalars()
        .all()
    )
    return [EngagementRead.model_validate(e) for e in engagements]
