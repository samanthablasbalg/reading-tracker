from __future__ import annotations

import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.blog_post import BlogPost
from app.models.engagement import Engagement
from app.models.enums import LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.models.standalone_entry import StandaloneEntry
from app.models.user import User
from tests.helpers import _create_book, _create_engagement, _log_progress


def test_create_engagement_stamps_current_user(
    client: TestClient, db: Session, seed_user: User
) -> None:
    book = _create_book(client)

    response = client.post(
        "/engagements", json={"book_id": book["id"], "edition_format": "print"}
    )

    engagement = db.get(Engagement, uuid.UUID(response.json()["id"]))
    assert engagement is not None
    assert engagement.user_id == seed_user.id


def test_engagement_requires_user_id(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    db.add(
        Engagement(
            book_id=uuid.UUID(book["id"]),
            status=ReadingStatus.reading,
            started_on=datetime.date(2026, 1, 1),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_standalone_entry_requires_user_id(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    db.add(
        StandaloneEntry(
            book_id=uuid.UUID(book["id"]),
            read_on=datetime.date(2026, 1, 1),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_blog_post_requires_user_id(db: Session) -> None:
    db.add(BlogPost(title="Test Post"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_progress_log_via_api_copies_owner_from_engagement(
    client: TestClient, db: Session, seed_user: User
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    _log_progress(client, engagement["id"], 50)

    log = db.execute(
        select(ProgressLog).where(
            ProgressLog.engagement_id == uuid.UUID(engagement["id"])
        )
    ).scalar_one()
    assert log.user_id == seed_user.id


def test_progress_log_rejects_owner_mismatched_with_engagement(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    other_user = User(email="someone-else@example.com")
    db.add(other_user)
    db.commit()

    db.add(
        ProgressLog(
            engagement_id=uuid.UUID(engagement["id"]),
            user_id=other_user.id,
            logged_on=datetime.date(2026, 1, 1),
            unit=LogUnit.pages,
            page_start=0,
            page_end=10,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
