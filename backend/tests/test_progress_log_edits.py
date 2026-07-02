from __future__ import annotations

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog
from tests.helpers import (
    _create_audio_engagement,
    _create_book,
    _create_engagement,
    _log_audio_progress,
    _log_progress,
)


def test_patch_log_date_updates_logged_on(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    assert eng_obj is not None
    eng_obj.started_on = datetime.date(2026, 1, 1)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_on": "2026-01-15"},
    )

    assert response.status_code == 200
    updated = db.get(ProgressLog, uuid.UUID(log["id"]))
    assert updated is not None
    assert updated.logged_on == datetime.date(2026, 1, 15)


def test_patch_log_date_before_started_on_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    log_obj = db.get(ProgressLog, uuid.UUID(log["id"]))
    assert eng_obj is not None and log_obj is not None
    eng_obj.started_on = datetime.date(2026, 1, 20)
    log_obj.logged_on = datetime.date(2026, 1, 22)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_on": "2026-01-19"},
    )

    assert response.status_code == 409


def test_patch_log_date_after_finished_on_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    log_obj = db.get(ProgressLog, uuid.UUID(log["id"]))
    assert eng_obj is not None and log_obj is not None
    eng_obj.started_on = datetime.date(2026, 1, 1)
    eng_obj.finished_on = datetime.date(2026, 1, 20)
    log_obj.logged_on = datetime.date(2026, 1, 18)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_on": "2026-01-21"},
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


def test_patch_log_page_exceeds_book_length_returns_409(client: TestClient) -> None:
    book_resp = client.post(
        "/books",
        json={"title": "Piranesi", "author": "Susanna Clarke", "page_count": 200},
    )
    assert book_resp.status_code == 201
    book = book_resp.json()
    client.post("/editions", json={"book_id": book["id"], "edition_format": "print"})
    engagement = _create_engagement(client, book["id"])
    latest = _log_progress(client, engagement["id"], 150)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"page_end": 250},
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


def test_patch_log_minute_exceeds_audio_length_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 60, audio_length_minutes=200)
    latest = _log_audio_progress(client, engagement["id"], 120)

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{latest['id']}",
        json={"minute_end": 250},
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


def test_patch_log_date_any_past_date_is_valid(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    _log_progress(client, engagement["id"], 100, logged_on="2026-01-10")
    second = _log_progress(client, engagement["id"], 200, logged_on="2026-01-20")

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    assert eng_obj is not None

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{second['id']}",
        json={"logged_on": "2026-01-05"},
    )

    assert response.status_code == 200


def test_patch_backdated_log_is_not_most_recent_for_progress_edit(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    first = _log_progress(client, engagement["id"], 100, logged_on="2026-01-10")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-20")

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    assert eng_obj is not None

    client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{first['id']}",
        json={"logged_on": "2026-01-05"},
    )

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{first['id']}",
        json={"page_end": 150},
    )

    assert response.status_code == 409


def test_patch_log_date_and_progress_together_when_date_makes_it_latest(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    first = _log_progress(client, engagement["id"], 100, logged_on="2026-01-10")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-20")

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{first['id']}",
        json={"logged_on": "2026-01-25", "page_end": 90},
    )

    assert response.status_code == 200


def test_patch_log_date_in_future_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    log = _log_progress(client, engagement["id"], 100)
    future = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    response = client.patch(
        f"/engagements/{engagement['id']}/progress-logs/{log['id']}",
        json={"logged_on": future},
    )

    assert response.status_code == 422
