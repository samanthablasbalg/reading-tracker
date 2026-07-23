from __future__ import annotations

import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import (
    book_crud,
    edition_crud,
    engagement_crud,
    engagement_edition_crud,
    progress_log_crud,
)
from app.exceptions import ConflictError, NotFoundError
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.enums import Format, LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.services.books import capture_audio_length
from app.services.engagements.progress_logs import latest_log, reject_future_date


def create_engagement(
    db: Session,
    *,
    book_id: uuid.UUID,
    edition_format: Format,
    status: ReadingStatus,
    user_id: uuid.UUID,
    audio_length_minutes: int | None = None,
    started_on: datetime.date | None = None,
) -> Engagement:
    book = book_crud.get_or_raise(db, book_id)

    reject_future_date(started_on)

    duplicate = db.execute(
        select(Engagement)
        .join(EngagementEdition)
        .join(Edition)
        .where(
            Engagement.book_id == book_id,
            Engagement.status == ReadingStatus.reading,
            Edition.edition_format == edition_format,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise ConflictError(
            f"Already have a {edition_format} engagement in progress for this book."
        )

    engagement = engagement_crud.create(
        db,
        Engagement(
            book_id=book_id,
            user_id=user_id,
            status=status,
            started_on=started_on or datetime.date.today(),
        ),
    )

    candidates = edition_crud.list_by(
        db, book_id=book_id, edition_format=edition_format
    )
    if len(candidates) == 0:
        raise NotFoundError(f"No {edition_format} edition exists for this book")
    if len(candidates) > 1:
        raise ConflictError(
            f"This book has more than one {edition_format} edition, so the app"
            " can't tell which one to start reading. Choosing a specific edition"
            " when starting a read isn't supported yet."
        )
    edition = candidates[0]

    engagement_edition_crud.create(
        db,
        EngagementEdition(
            engagement_id=engagement.id,
            edition_id=edition.id,
            user_id=engagement.user_id,
        ),
    )

    if audio_length_minutes is not None:
        capture_audio_length(book, edition, audio_length_minutes)

    return engagement


def _reject_duplicate_reading(db: Session, engagement: Engagement) -> None:
    duplicate = db.execute(
        select(Engagement).where(
            Engagement.book_id == engagement.book_id,
            Engagement.status == ReadingStatus.reading,
            Engagement.id != engagement.id,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise ConflictError("Already reading another engagement for this book.")


def _transition_to_finished(
    db: Session, engagement: Engagement, effective_on: datetime.date
) -> None:
    latest = latest_log(engagement.progress_logs)
    if latest is not None and effective_on < latest.logged_on:
        raise ConflictError("finished_on cannot be before the latest progress log.")
    if (
        latest is None
        and engagement.started_on is not None
        and effective_on < engagement.started_on
    ):
        raise ConflictError("finished_on cannot be before started_on.")

    engagement.finished_on = effective_on
    if Format.audio not in engagement.formats:
        page_count = engagement.book.default_page_count
        if page_count is not None and engagement.resume_from_page != page_count:
            progress_log_crud.create(
                db,
                ProgressLog(
                    engagement_id=engagement.id,
                    user_id=engagement.user_id,
                    logged_on=effective_on,
                    unit=LogUnit.pages,
                    page_start=engagement.resume_from_page,
                    page_end=page_count,
                    new_ground=True,
                ),
            )
    else:
        audio_length = engagement.resolve_length(Format.audio)
        if audio_length is not None and engagement.resume_from_minute != audio_length:
            progress_log_crud.create(
                db,
                ProgressLog(
                    engagement_id=engagement.id,
                    user_id=engagement.user_id,
                    logged_on=effective_on,
                    unit=LogUnit.minutes,
                    minute_start=engagement.resume_from_minute,
                    minute_end=audio_length,
                    new_ground=True,
                ),
            )


def _transition_to_dnf(
    engagement: Engagement,
    effective_on: datetime.date | None,
    resolved_on: datetime.date,
) -> None:
    latest = latest_log(engagement.progress_logs)
    if latest is None:
        engagement.abandoned_on = resolved_on
        return
    if effective_on is not None and effective_on < latest.logged_on:
        raise ConflictError("abandoned_on cannot be before the latest progress log.")
    engagement.abandoned_on = effective_on or latest.logged_on


def update_status(
    db: Session,
    engagement: Engagement,
    *,
    new_status: ReadingStatus,
    effective_on: datetime.date | None,
) -> None:
    if new_status == engagement.status:
        return

    if new_status == ReadingStatus.reading:
        _reject_duplicate_reading(db, engagement)

    resolved_on = effective_on or datetime.date.today()
    reject_future_date(resolved_on)

    engagement.status = new_status
    match new_status:
        case ReadingStatus.reading:
            engagement.finished_on = None
            engagement.abandoned_on = None
        case ReadingStatus.finished:
            _transition_to_finished(db, engagement, resolved_on)
        case ReadingStatus.dnf:
            _transition_to_dnf(engagement, effective_on, resolved_on)


def apply_date_change(
    engagement: Engagement,
    started_on: datetime.date | None,
    finished_on: datetime.date | None,
) -> None:
    logs = sorted(
        engagement.progress_logs, key=lambda log: (log.logged_on, log.created_at)
    )
    earliest_log_date = logs[0].logged_on if logs else None
    latest_log_date = logs[-1].logged_on if logs else None

    effective_started = started_on if started_on is not None else engagement.started_on
    effective_finished = (
        finished_on if finished_on is not None else engagement.finished_on
    )

    if (
        effective_finished is not None
        and effective_started is not None
        and effective_finished < effective_started
    ):
        raise ConflictError("finished_on cannot be before started_on.")
    if (
        started_on is not None
        and earliest_log_date is not None
        and started_on > earliest_log_date
    ):
        raise ConflictError("started_on cannot be after the earliest progress log.")
    if (
        finished_on is not None
        and latest_log_date is not None
        and finished_on < latest_log_date
    ):
        raise ConflictError("finished_on cannot be before the latest progress log.")

    if started_on is not None:
        engagement.started_on = started_on
    if finished_on is not None:
        engagement.finished_on = finished_on
