from __future__ import annotations

import datetime
import uuid
from collections.abc import Callable
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.models.author import Author
from app.models.blog_post import BlogPost
from app.models.book import Book
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.enums import LogUnit, ReadingStatus
from app.models.progress_log import ProgressLog
from app.models.review import Review
from app.models.standalone_entry import StandaloneEntry
from app.models.user import User
from tests.helpers import _create_book

OWNED_MODELS = (
    Engagement,
    StandaloneEntry,
    BlogPost,
    ProgressLog,
    Review,
    EngagementEdition,
)


def _seed_owned_graph(
    owner_db: Session,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
    edition_id: uuid.UUID,
) -> None:
    engagement = Engagement(
        book_id=book_id,
        user_id=user_id,
        status=ReadingStatus.reading,
        started_on=datetime.date(2026, 1, 1),
    )
    owner_db.add(engagement)
    owner_db.flush()

    owner_db.add(
        StandaloneEntry(
            book_id=book_id, user_id=user_id, read_on=datetime.date(2026, 1, 1)
        )
    )
    owner_db.add(BlogPost(user_id=user_id, title="A post"))
    owner_db.add(
        ProgressLog(
            engagement_id=engagement.id,
            user_id=user_id,
            logged_on=datetime.date(2026, 1, 1),
            unit=LogUnit.pages,
            page_start=0,
            page_end=10,
        )
    )
    owner_db.add(
        Review(
            engagement_id=engagement.id,
            user_id=user_id,
            rating=Decimal("4.00"),
            written_at=datetime.datetime.now(datetime.UTC),
        )
    )
    owner_db.add(
        EngagementEdition(
            engagement_id=engagement.id, edition_id=edition_id, user_id=user_id
        )
    )
    owner_db.commit()


def test_personal_tables_isolate_by_current_user(
    client: TestClient,
    owner_db: Session,
    app_session: Callable[[uuid.UUID], Session],
    seed_user: User,
) -> None:
    book_id = uuid.UUID(_create_book(client)["id"])
    edition_id = (
        owner_db.execute(select(Edition.id).where(Edition.book_id == book_id))
        .scalars()
        .first()
    )
    assert edition_id is not None

    user_y = User(email="user-y@example.com")
    owner_db.add(user_y)
    owner_db.commit()

    _seed_owned_graph(owner_db, seed_user.id, book_id, edition_id)
    _seed_owned_graph(owner_db, user_y.id, book_id, edition_id)

    session_x = app_session(seed_user.id)
    for model in OWNED_MODELS:
        user_ids = session_x.execute(select(model.user_id)).scalars().all()
        assert user_ids == [seed_user.id]


def test_insert_claiming_another_users_id_is_rejected(
    owner_db: Session,
    app_session: Callable[[uuid.UUID], Session],
    seed_user: User,
) -> None:
    user_y = User(email="user-y@example.com")
    owner_db.add(user_y)
    owner_db.commit()

    session_x = app_session(seed_user.id)
    session_x.add(BlogPost(user_id=user_y.id, title="Not mine"))
    with pytest.raises(ProgrammingError):
        session_x.flush()
    session_x.rollback()


def test_reference_tables_readable_regardless_of_current_user(
    client: TestClient,
    owner_db: Session,
    app_session: Callable[[uuid.UUID], Session],
    seed_user: User,
) -> None:
    book_id = uuid.UUID(_create_book(client)["id"])

    user_y = User(email="user-y@example.com")
    owner_db.add(user_y)
    owner_db.commit()

    for user_id in (seed_user.id, user_y.id):
        session = app_session(user_id)
        assert session.get(Book, book_id) is not None
        assert session.execute(select(Author)).scalars().first() is not None
        assert (
            session.execute(select(Edition).where(Edition.book_id == book_id))
            .scalars()
            .first()
            is not None
        )
