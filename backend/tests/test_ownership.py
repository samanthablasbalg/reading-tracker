from __future__ import annotations

import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.blog_post import BlogPost
from app.models.engagement import Engagement
from app.models.enums import ReadingStatus
from app.models.standalone_entry import StandaloneEntry
from app.models.user import User
from tests.helpers import _create_book


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
