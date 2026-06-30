from __future__ import annotations

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog
from tests.helpers import (
    _create_audio_engagement,
    _create_bare_book,
    _create_book,
    _create_edition,
    _create_engagement,
    _log_audio_progress,
    _log_progress,
)

# --- Progress logging ---


def test_log_progress_returns_201_with_correct_fields(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    log = _log_progress(client, engagement["id"], 100)

    assert log["engagement_id"] == engagement["id"]
    assert log["page_start"] == 0
    assert log["page_end"] == 100
    assert log["unit"] == "pages"
    assert log["new_ground"] is True


def test_log_progress_derives_start_from_last_log(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    second = _log_progress(client, engagement["id"], 250)

    assert second["page_start"] == 100
    assert second["page_end"] == 250


def test_log_progress_unknown_engagement_returns_404(client: TestClient) -> None:
    response = client.post(
        f"/engagements/{uuid.uuid4()}/progress-logs",
        json={"current_page": 50},
    )
    assert response.status_code == 404


def test_log_progress_finished_engagement_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 50},
    )
    assert response.status_code == 409


def test_log_progress_page_equal_to_last_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 100},
    )
    assert response.status_code == 409


def test_log_progress_page_less_than_last_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 50},
    )
    assert response.status_code == 409


def test_log_progress_zero_page_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 0},
    )
    assert response.status_code == 422


def test_log_progress_negative_page_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": -10},
    )
    assert response.status_code == 422


# --- Derived engagement fields ---


def test_engagement_resume_from_page_is_zero_before_logging(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    assert engagement["resume_from_page"] == 0


def test_engagement_resume_from_page_reflects_latest_log(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 150)
    _log_progress(client, engagement["id"], 300)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["resume_from_page"] == 300


def test_engagement_completion_pct_is_null_without_page_count(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] is None


def test_engagement_completion_pct_is_null_when_page_count_is_zero(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 0
    db.commit()
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] is None


def test_engagement_completion_pct_is_null_before_logging(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"])

    assert engagement["completion_pct"] is None


def test_engagement_completion_pct_after_logging(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 150)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 50


def test_engagement_completion_pct_capped_at_100(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 350)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 100


# --- Landmine: status cycle must not touch progress_logs ---


def test_progress_logs_preserved_through_status_cycle(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})
    client.patch(f"/engagements/{engagement['id']}", json={"status": "reading"})

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["resume_from_page"] == 100

    second = _log_progress(client, engagement["id"], 200)
    assert second["page_start"] == 100


# --- completion_pct via binding ---


def test_completion_pct_uses_binding_length_override(
    client: TestClient, db: Session
) -> None:
    book = _create_bare_book(client)
    _create_edition(client, book["id"], page_count=400)
    engagement = _create_engagement(client, book["id"])

    binding = db.execute(
        select(EngagementEdition).where(
            EngagementEdition.engagement_id == uuid.UUID(engagement["id"])
        )
    ).scalar_one()
    binding.length_override = 200
    db.commit()

    _log_progress(client, engagement["id"], 100)

    data = client.get("/engagements?status=reading").json()
    assert data[0]["completion_pct"] == 50


def test_completion_pct_uses_edition_page_count_when_no_override(
    client: TestClient,
) -> None:
    book = _create_bare_book(client)
    _create_edition(client, book["id"], page_count=400)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 200)

    data = client.get("/engagements?status=reading").json()
    assert data[0]["completion_pct"] == 50


def test_completion_pct_binding_takes_precedence_over_book_page_count(
    client: TestClient, db: Session
) -> None:
    book = _create_bare_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 400
    db.commit()

    _create_edition(client, book["id"])
    engagement = _create_engagement(client, book["id"])

    binding = db.execute(
        select(EngagementEdition).where(
            EngagementEdition.engagement_id == uuid.UUID(engagement["id"])
        )
    ).scalar_one()
    binding.length_override = 200
    db.commit()

    _log_progress(client, engagement["id"], 100)

    data = client.get("/engagements?status=reading").json()
    assert data[0]["completion_pct"] == 50


# --- Finish log ---


def test_finish_creates_final_progress_log(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 150)

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    )
    assert response.status_code == 200
    assert response.json()["completion_pct"] == 100

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 2
    final_log = max(logs, key=lambda log: (log.logged_on, log.created_at))
    assert final_log.page_start == 150
    assert final_log.page_end == 300


def test_finish_does_not_duplicate_log_when_already_at_page_count(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 300)

    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 1


def test_finish_with_no_page_count_creates_no_log(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 150)

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    )
    assert response.status_code == 200

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 1


# --- Audio finish log ---


def test_finish_audio_creates_final_minutes_log(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_audio_minutes = 480
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240)

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    )
    assert response.status_code == 200
    assert response.json()["completion_pct"] == 100

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 2
    final_log = max(logs, key=lambda log: (log.logged_on, log.created_at))
    assert final_log.unit.value == "minutes"
    assert final_log.minute_start == 240
    assert final_log.minute_end == 480


def test_finish_audio_does_not_duplicate_log_when_already_at_length(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_audio_minutes = 480
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 480)

    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 1


def test_finish_audio_with_no_length_creates_no_log(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240)

    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(logs) == 1


def test_finish_audio_does_not_create_page_log(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    book_obj.default_audio_minutes = 480
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240)

    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    assert all(log.unit.value == "minutes" for log in logs)


# --- Audio progress logging ---


def test_audio_log_returns_201_with_minutes_fields(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    log = _log_audio_progress(client, engagement["id"], 75)

    assert log["unit"] == "minutes"
    assert log["minute_start"] == 0
    assert log["minute_end"] == 75
    assert log["page_start"] is None
    assert log["page_end"] is None
    assert log["new_ground"] is True


def test_audio_log_derives_minute_start_from_last_log(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 75)

    second = _log_audio_progress(client, engagement["id"], 150)

    assert second["minute_start"] == 75
    assert second["minute_end"] == 150


def test_audio_engagement_resume_from_minute_is_zero_before_logging(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    assert engagement["resume_from_minute"] == 0


def test_audio_engagement_resume_from_minute_reflects_latest_log(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 75)
    _log_audio_progress(client, engagement["id"], 150)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["resume_from_minute"] == 150


def test_audio_log_advance_guard_equal_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 75)

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_minute": 75},
    )
    assert response.status_code == 409


def test_audio_log_advance_guard_less_than_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 75)

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_minute": 50},
    )
    assert response.status_code == 409


def test_audio_engagement_requires_current_minute(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 100},
    )
    assert response.status_code == 422


def test_print_engagement_requires_current_page(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_minute": 75},
    )
    assert response.status_code == 422


def test_length_capture_writes_book_default_audio_minutes(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    _log_audio_progress(client, engagement["id"], 75, audio_length_minutes=480)

    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    assert book_obj.default_audio_minutes == 480


def test_length_capture_writes_edition_audio_minutes(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    _log_audio_progress(client, engagement["id"], 75, audio_length_minutes=480)

    edition = db.execute(
        select(Edition).where(
            Edition.book_id == uuid.UUID(book["id"]),
            Edition.edition_format == "audio",
        )
    ).scalar_one()
    assert edition.audio_minutes == 480


def test_length_capture_does_not_overwrite_existing_length(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_audio_minutes = 300
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])

    _log_audio_progress(client, engagement["id"], 75, audio_length_minutes=480)

    db.refresh(book_obj)
    assert book_obj.default_audio_minutes == 300


def test_audio_completion_pct_uses_captured_length(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240, audio_length_minutes=480)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 50


def test_audio_completion_pct_uses_edition_audio_minutes(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    edition = db.execute(
        select(Edition).where(
            Edition.book_id == uuid.UUID(book["id"]),
            Edition.edition_format == "audio",
        )
    ).scalar_one()
    edition.audio_minutes = 480
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 50


def test_audio_completion_pct_falls_back_to_book_default_audio_minutes(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_audio_minutes = 480
    db.commit()
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 240)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 50


def test_audio_completion_pct_null_when_no_length_set(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])
    _log_audio_progress(client, engagement["id"], 75)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] is None


def test_audio_completion_pct_null_before_logging(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_audio_engagement(client, book["id"])

    assert engagement["completion_pct"] is None


def test_resume_from_page_unaffected_by_minute_logs(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["resume_from_page"] == 100
    assert response.json()[0]["resume_from_minute"] == 0


# --- List progress logs ---


def test_list_progress_logs_returns_200_ordered_by_date(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    _log_progress(client, engagement["id"], 100)
    _log_progress(client, engagement["id"], 200)

    response = client.get(f"/engagements/{engagement['id']}/progress-logs")

    assert response.status_code == 200
    logs = response.json()
    assert len(logs) == 2
    assert logs[0]["page_end"] == 100
    assert logs[1]["page_end"] == 200


def test_list_progress_logs_returns_empty_list_when_no_logs(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.get(f"/engagements/{engagement['id']}/progress-logs")

    assert response.status_code == 200
    assert response.json() == []


def test_list_progress_logs_unknown_engagement_returns_404(client: TestClient) -> None:
    response = client.get(f"/engagements/{uuid.uuid4()}/progress-logs")
    assert response.status_code == 404


# --- logged_on ordering ---


def test_same_day_logs_ordered_by_creation(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    _log_progress(client, engagement["id"], 100, logged_on="2026-01-10")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-10")

    logs = client.get(f"/engagements/{engagement['id']}/progress-logs").json()

    assert logs[0]["page_end"] == 100
    assert logs[1]["page_end"] == 200


def test_multiple_backdated_days_sorted_by_date(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    # Create in reverse date order (Jan 30, Jan 10, Jan 20).
    # Pages must exceed the canonical resume each time so the guard passes.
    # After Jan 30 (page 100): canonical latest = Jan 30, resume = 100.
    # Jan 10 (page 200): 200 > 100, OK. Canonical latest still Jan 30.
    # Jan 20 (page 300): 300 > 100, OK.
    _log_progress(client, engagement["id"], 100, logged_on="2026-01-30")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-10")
    _log_progress(client, engagement["id"], 300, logged_on="2026-01-20")

    logs = client.get(f"/engagements/{engagement['id']}/progress-logs").json()

    assert logs[0]["logged_on"] == "2026-01-10"
    assert logs[1]["logged_on"] == "2026-01-20"
    assert logs[2]["logged_on"] == "2026-01-30"


def test_log_before_started_on_returns_409(client: TestClient, db: Session) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    eng_obj = db.get(Engagement, uuid.UUID(engagement["id"]))
    assert eng_obj is not None
    eng_obj.started_on = datetime.date(2026, 1, 15)
    db.commit()

    response = client.post(
        f"/engagements/{engagement['id']}/progress-logs",
        json={"current_page": 50, "logged_on": "2026-01-10"},
    )

    assert response.status_code == 409


def test_finish_uses_effective_on_for_finished_on_and_completion_log(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    _log_progress(client, engagement["id"], 150, logged_on="2026-01-10")

    response = client.patch(
        f"/engagements/{engagement['id']}",
        json={"status": "finished", "effective_on": "2026-01-15"},
    )

    assert response.status_code == 200
    assert response.json()["finished_on"] == "2026-01-15"

    logs = (
        db.execute(
            select(ProgressLog).where(
                ProgressLog.engagement_id == uuid.UUID(engagement["id"])
            )
        )
        .scalars()
        .all()
    )
    completion_log = max(logs, key=lambda log: log.created_at)
    assert completion_log.logged_on == datetime.date(2026, 1, 15)


def test_finish_effective_on_before_latest_log_returns_409(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    _log_progress(client, engagement["id"], 150, logged_on="2026-01-20")

    response = client.patch(
        f"/engagements/{engagement['id']}",
        json={"status": "finished", "effective_on": "2026-01-15"},
    )

    assert response.status_code == 409


def test_resume_from_page_uses_canonical_order_latest(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    # Jan 30 (page 100) created first → canonical latest.
    # Jan 20 (page 200) created second but earlier date → 200 > resume(100), OK.
    # Canonical latest stays Jan 30, so resume_from_page = 100, not 200.
    _log_progress(client, engagement["id"], 100, logged_on="2026-01-30")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-20")

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["resume_from_page"] == 100


def test_completion_pct_uses_canonical_order_latest(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_page_count = 300
    db.commit()
    engagement = _create_engagement(client, book["id"], started_on="2026-01-01")
    # Jan 30 (page 100) is canonical latest → completion_pct = 33, not 67.
    _log_progress(client, engagement["id"], 100, logged_on="2026-01-30")
    _log_progress(client, engagement["id"], 200, logged_on="2026-01-20")

    response = client.get("/engagements?status=reading")
    assert response.json()[0]["completion_pct"] == 33
