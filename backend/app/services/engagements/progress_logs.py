from __future__ import annotations

import datetime

from sqlalchemy.orm import Session

from app.crud import CRUDBase
from app.exceptions import ConflictError, InvalidOperationError
from app.models.engagement import Engagement
from app.models.enums import Format, LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.services.books import capture_audio_length

progress_log_crud = CRUDBase(ProgressLog)


def reject_future_date(value: datetime.date | None) -> None:
    if value is not None and value > datetime.date.today():
        raise InvalidOperationError("Date cannot be in the future.")


def log_sort_key(log: ProgressLog) -> tuple[datetime.date, datetime.datetime]:
    return (log.logged_on, log.created_at)


def latest_log(logs: list[ProgressLog]) -> ProgressLog | None:
    return max(logs, key=log_sort_key) if logs else None


def log_progress(
    db: Session,
    engagement: Engagement,
    *,
    current_page: int | None,
    current_minute: int | None,
    logged_on: datetime.date | None,
    audio_length_minutes: int | None,
) -> ProgressLog:
    if engagement.status != ReadingStatus.reading:
        raise ConflictError("Can only log progress on an engagement being read.")

    is_audio = Format.audio in engagement.formats
    unit = LogUnit.minutes if is_audio else LogUnit.pages
    position = current_minute if is_audio else current_page
    resume = engagement.resume_from_minute if is_audio else engagement.resume_from_page

    if position is None:
        raise InvalidOperationError(
            "current_minute is required for audio, current_page otherwise."
        )
    if position <= resume:
        raise ConflictError("Progress must advance beyond the current position.")

    resolved_on = logged_on or datetime.date.today()
    reject_future_date(resolved_on)
    if engagement.started_on is not None and resolved_on < engagement.started_on:
        raise ConflictError("Log date cannot be before the engagement's start date.")
    if any(log.logged_on > resolved_on for log in engagement.progress_logs):
        raise ConflictError(
            "A log already exists on a later day; you can only correct the most"
            " recent day."
        )

    log = progress_log_crud.create(
        db,
        ProgressLog(
            engagement_id=engagement.id,
            user_id=engagement.user_id,
            logged_on=resolved_on,
            unit=unit,
            minute_start=resume if is_audio else None,
            minute_end=position if is_audio else None,
            page_start=None if is_audio else resume,
            page_end=None if is_audio else position,
            new_ground=True,
        ),
    )

    if is_audio and audio_length_minutes is not None:
        audio_ee = next(
            (
                ee
                for ee in engagement.engagement_editions
                if ee.edition.edition_format == Format.audio
            ),
            None,
        )
        if audio_ee is not None:
            capture_audio_length(
                engagement.book, audio_ee.edition, audio_length_minutes
            )

    return log


def update_progress_log(
    engagement: Engagement,
    log: ProgressLog,
    *,
    logged_on: datetime.date | None,
    page_end: int | None,
    minute_end: int | None,
) -> None:
    if logged_on is not None:
        reject_future_date(logged_on)
        if engagement.started_on is not None and logged_on < engagement.started_on:
            raise ConflictError(
                "That date would be before the engagement's start date."
            )
        if engagement.finished_on is not None and logged_on > engagement.finished_on:
            raise ConflictError(
                "That date would be after the engagement's finish date."
            )
        log.logged_on = logged_on

    editing_progress = page_end is not None or minute_end is not None
    if editing_progress:
        latest = latest_log(engagement.progress_logs)
        if latest is not None and log.id != latest.id:
            raise ConflictError("Only the most recent entry's progress can be edited.")

    if page_end is not None:
        if page_end <= (log.page_start or 0):
            raise ConflictError(
                "Page must be higher than this session's starting page."
            )
        fmt = next((f for f in engagement.formats if f != Format.audio), Format.print)
        book_length = engagement.resolve_length(fmt)
        if book_length is not None and page_end > book_length:
            raise ConflictError("Page cannot exceed the book's length.")
        log.page_end = page_end

    if minute_end is not None:
        if minute_end <= (log.minute_start or 0):
            raise ConflictError(
                "Minute must be higher than this session's starting minute."
            )
        audio_length = engagement.resolve_length(Format.audio)
        if audio_length is not None and minute_end > audio_length:
            raise ConflictError("Minute cannot exceed the audio length.")
        log.minute_end = minute_end


def delete_progress_log(db: Session, engagement: Engagement, log: ProgressLog) -> None:
    latest = latest_log(engagement.progress_logs)
    if latest is not None and log.id != latest.id:
        raise ConflictError("Only the most recent progress log can be deleted.")
    progress_log_crud.delete(db, log)
