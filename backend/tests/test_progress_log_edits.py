from __future__ import annotations

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.progress_log import ProgressLog
from tests.helpers import (
    _create_audio_engagement,
    _create_book,
    _create_engagement,
    _log_audio_progress,
    _log_progress,
)


def test_patch_log_date_updates_logged_at(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_at": "2026-01-15"},
    )

    assert response.status_code == 200
    updated = db.get(ProgressLog, uuid.UUID(log["id"]))
    assert updated is not None
    assert updated.logged_at.astimezone(datetime.UTC).date() == datetime.date(
        2026, 1, 15
    )


def test_patch_log_date_preserves_time_of_day(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)

    original_log = db.get(ProgressLog, uuid.UUID(log["id"]))
    assert original_log is not None
    original_time = original_log.logged_at.astimezone(datetime.UTC)

    client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_at": "2026-01-15"},
    )

    db.refresh(original_log)
    updated_time = original_log.logged_at.astimezone(datetime.UTC)
    assert updated_time.hour == original_time.hour
    assert updated_time.minute == original_time.minute
    assert updated_time.second == original_time.second


def test_patch_log_date_before_previous_log_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    first = _log_progress(client, engagement["id"], 100)
    second = _log_progress(client, engagement["id"], 200)

    first_obj = db.get(ProgressLog, uuid.UUID(first["id"]))
    second_obj = db.get(ProgressLog, uuid.UUID(second["id"]))
    assert first_obj is not None and second_obj is not None
    first_obj.logged_at = datetime.datetime(2026, 1, 10, 12, 0, 0, tzinfo=datetime.UTC)
    second_obj.logged_at = datetime.datetime(2026, 1, 20, 12, 0, 0, tzinfo=datetime.UTC)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{second['id']}",
        json={"logged_at": "2026-01-09"},
    )

    assert response.status_code == 409


def test_patch_log_date_after_next_log_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    first = _log_progress(client, engagement["id"], 100)
    second = _log_progress(client, engagement["id"], 200)

    first_obj = db.get(ProgressLog, uuid.UUID(first["id"]))
    second_obj = db.get(ProgressLog, uuid.UUID(second["id"]))
    assert first_obj is not None and second_obj is not None
    first_obj.logged_at = datetime.datetime(2026, 1, 10, 12, 0, 0, tzinfo=datetime.UTC)
    second_obj.logged_at = datetime.datetime(2026, 1, 20, 12, 0, 0, tzinfo=datetime.UTC)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{first['id']}",
        json={"logged_at": "2026-01-21"},
    )

    assert response.status_code == 409


def test_patch_log_page_on_most_recent_updates_page_end(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)
    latest = _log_progress(client, engagement["id"], 200)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"page_end": 250},
    )

    assert response.status_code == 200
    updated = db.get(ProgressLog, uuid.UUID(latest["id"]))
    assert updated is not None
    assert updated.page_end == 250


def test_patch_log_page_on_non_recent_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    first = _log_progress(client, engagement["id"], 100)
    _log_progress(client, engagement["id"], 200)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{first['id']}",
        json={"page_end": 150},
    )

    assert response.status_code == 409


def test_patch_log_page_at_or_below_start_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)
    latest = _log_progress(client, engagement["id"], 200)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"page_end": 100},
    )

    assert response.status_code == 409


def test_patch_log_minute_on_most_recent_updates_minute_end(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 60)
    latest = _log_audio_progress(client, engagement["id"], 120)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"minute_end": 150},
    )

    assert response.status_code == 200
    updated = db.get(ProgressLog, uuid.UUID(latest["id"]))
    assert updated is not None
    assert updated.minute_end == 150


def test_patch_log_minute_at_or_below_start_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 60)
    latest = _log_audio_progress(client, engagement["id"], 120)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"minute_end": 60},
    )

    assert response.status_code == 409


def test_patch_log_unknown_engagement_returns_404(client: TestClient) -> None:
    response = client.patch(
        f"/engagements/{uuid.uuid4()}/progress-logs/{uuid.uuid4()}",
        json={"page_end": 100},
    )
    assert response.status_code == 404


def test_patch_log_unknown_log_returns_404(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{uuid.uuid4()}",
        json={"page_end": 100},
    )
    assert response.status_code == 404
