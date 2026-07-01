from __future__ import annotations

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog
from tests.helpers import (
    _create_book,
    _create_engagement,
    _log_progress,
)


def test_patch_dates_started_on_persists(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"started_on": "2026-01-01"},
    )

    assert response.status_code == 200
    assert response.json()["started_on"] == "2026-01-01"


def test_patch_dates_finished_on_persists(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"finished_on": "2026-12-01"},
    )

    assert response.status_code == 200
    assert response.json()["finished_on"] == "2026-12-01"


def test_patch_dates_both_persist(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"started_on": "2026-01-01", "finished_on": "2026-06-01"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["started_on"] == "2026-01-01"
    assert data["finished_on"] == "2026-06-01"


def test_patch_dates_unknown_engagement_returns_404(client: TestClient) -> None:
    response = client.patch(
        f"/engagements/{uuid.uuid4()}/dates",
        json={"started_on": "2026-01-01"},
    )
    assert response.status_code == 404


def test_patch_dates_does_not_change_status(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"started_on": "2026-01-01", "finished_on": "2026-06-01"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "reading"


def test_patch_dates_finished_before_started_in_payload_returns_409(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"started_on": "2026-06-01", "finished_on": "2026-01-01"},
    )
    assert response.status_code == 409


def test_patch_dates_finished_before_existing_started_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    assert eng_obj is not None
    eng_obj.started_on = datetime.date(2026, 6, 1)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"finished_on": "2026-01-01"},
    )
    assert response.status_code == 409


def test_patch_dates_started_after_earliest_log_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    log = db.execute(
        select(ProgressLog).where(
            ProgressLog.engagement_id == uuid.UUID(engagement["id"])
        )
    ).scalar_one()
    log.logged_on = datetime.date(2026, 3, 15)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"started_on": "2026-04-01"},
    )
    assert response.status_code == 409


def test_patch_dates_finished_before_latest_log_returns_409(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    log = db.execute(
        select(ProgressLog).where(
            ProgressLog.engagement_id == uuid.UUID(engagement["id"])
        )
    ).scalar_one()
    log.logged_on = datetime.date(2026, 3, 15)
    db.commit()

    response = client.patch(
        f"/engagements/{engagement['id']}/dates",
        json={"finished_on": "2026-03-01"},
    )
    assert response.status_code == 409
