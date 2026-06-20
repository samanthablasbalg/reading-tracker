from __future__ import annotations

import datetime
import uuid
from typing import Any, cast

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog


def _create_book(
    client: TestClient,
    title: str = "Piranesi",
    author: str = "Susanna Clarke",
) -> dict[str, Any]:
    response = client.post("/books", json={"title": title, "author": author})
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _create_engagement(client: TestClient, book_id: str) -> dict[str, Any]:
    response = client.post("/engagements", json={"book_id": book_id})
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _log_progress(
    client: TestClient, engagement_id: str, current_page: int
) -> dict[str, Any]:
    response = client.post(
        f"/engagements/{engagement_id}/progress-logs",
        json={"current_page": current_page},
    )
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


# --- Create ---


def test_create_engagement_returns_201(client: TestClient) -> None:
    book = _create_book(client)
    response = client.post("/engagements", json={"book_id": book["id"]})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "reading"
    assert data["started_on"] is not None
    assert data["finished_on"] is None
    assert data["book"]["title"] == "Piranesi"
    assert data["book"]["authors"][0]["name"] == "Susanna Clarke"


def test_create_engagement_unknown_book_returns_404(client: TestClient) -> None:
    response = client.post("/engagements", json={"book_id": str(uuid.uuid4())})
    assert response.status_code == 404


def test_create_engagement_duplicate_active_read_returns_409(
    client: TestClient,
) -> None:
    book = _create_book(client)
    _create_engagement(client, book["id"])
    response = client.post("/engagements", json={"book_id": book["id"]})
    assert response.status_code == 409


def test_create_engagement_on_finished_book_succeeds(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})
    response = client.post("/engagements", json={"book_id": book["id"]})
    assert response.status_code == 201
    assert response.json()["status"] == "reading"


def test_create_engagement_copies_book_cover_url(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_obj = db.get(Book, uuid.UUID(book["id"]))
    assert book_obj is not None
    book_obj.default_cover_url = "https://covers.example/dune.jpg"
    db.commit()

    response = client.post("/engagements", json={"book_id": book["id"]})
    assert response.status_code == 201
    assert response.json()["cover_url"] == "https://covers.example/dune.jpg"


def test_create_engagement_cover_url_is_null_without_book_cover(
    client: TestClient,
) -> None:
    book = _create_book(client)
    response = client.post("/engagements", json={"book_id": book["id"]})
    assert response.status_code == 201
    assert response.json()["cover_url"] is None


# --- Transition ---


def test_patch_to_finished_stamps_finished_on(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "finished"
    assert data["finished_on"] is not None
    assert data["started_on"] == engagement["started_on"]


def test_patch_to_reading_clears_finished_on(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "reading"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reading"
    assert data["finished_on"] is None


def test_patch_unknown_engagement_returns_404(client: TestClient) -> None:
    response = client.patch(f"/engagements/{uuid.uuid4()}", json={"status": "finished"})
    assert response.status_code == 404


def test_patch_invalid_status_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "interested"}
    )
    assert response.status_code == 422


def test_patch_same_status_is_idempotent(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "reading"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reading"
    assert data["finished_on"] is None


def test_patch_finished_to_finished_does_not_overwrite_date(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])
    first = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    ).json()
    original_date = first["finished_on"]

    second = client.patch(
        f"/engagements/{engagement['id']}", json={"status": "finished"}
    ).json()
    assert second["finished_on"] == original_date


def test_patch_back_to_reading_conflicts_when_another_active_read_exists(
    client: TestClient,
) -> None:
    book = _create_book(client)
    eng_a = _create_engagement(client, book["id"])
    client.patch(f"/engagements/{eng_a['id']}", json={"status": "finished"})
    _create_engagement(client, book["id"])

    response = client.patch(f"/engagements/{eng_a['id']}", json={"status": "reading"})
    assert response.status_code == 409


# --- List views ---


def test_list_reading_excludes_finished(client: TestClient) -> None:
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _create_engagement(client, book_a["id"])
    _create_engagement(client, book_b["id"])
    client.patch(f"/engagements/{eng_a['id']}", json={"status": "finished"})

    response = client.get("/engagements?status=reading")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["book"]["title"] == "Book B"


def test_list_finished_excludes_reading(client: TestClient) -> None:
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _create_engagement(client, book_a["id"])
    _create_engagement(client, book_b["id"])
    client.patch(f"/engagements/{eng_a['id']}", json={"status": "finished"})

    response = client.get("/engagements?status=finished")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["book"]["title"] == "Book A"
    assert data[0]["finished_on"] is not None


def test_list_invalid_status_returns_422(client: TestClient) -> None:
    response = client.get("/engagements?status=interested")
    assert response.status_code == 422


def test_list_missing_status_returns_422(client: TestClient) -> None:
    response = client.get("/engagements")
    assert response.status_code == 422


def test_list_empty_returns_empty_list(client: TestClient) -> None:
    response = client.get("/engagements?status=reading")
    assert response.status_code == 200
    assert response.json() == []


def test_list_includes_nested_book_details(client: TestClient) -> None:
    book = _create_book(client, title="A Memory Called Empire", author="Arkady Martine")
    _create_engagement(client, book["id"])

    response = client.get("/engagements?status=reading")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    item = data[0]
    assert item["book"]["title"] == "A Memory Called Empire"
    assert item["book"]["authors"][0]["name"] == "Arkady Martine"
    assert item["started_on"] is not None
    assert item["finished_on"] is None


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


# --- Ordering ---


def _set_updated_at(db: Session, engagement_id: str, when: datetime.datetime) -> None:
    engagement = db.get(Engagement, uuid.UUID(engagement_id))
    assert engagement is not None
    engagement.updated_at = when
    db.commit()


def _set_logged_at(db: Session, engagement_id: str, when: datetime.datetime) -> None:
    log = db.execute(
        select(ProgressLog).where(ProgressLog.engagement_id == uuid.UUID(engagement_id))
    ).scalar_one()
    log.logged_at = when
    db.commit()


def test_list_reading_orders_more_recently_marked_first(
    client: TestClient, db: Session
) -> None:
    # No logs: the engagement touched (marked reading) most recently leads.
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _create_engagement(client, book_a["id"])
    eng_b = _create_engagement(client, book_b["id"])

    _set_updated_at(db, eng_a["id"], datetime.datetime(2024, 1, 1, tzinfo=datetime.UTC))
    _set_updated_at(db, eng_b["id"], datetime.datetime(2024, 6, 1, tzinfo=datetime.UTC))

    data = client.get("/engagements?status=reading").json()
    assert [e["book"]["title"] for e in data] == ["Book B", "Book A"]


def test_list_reading_log_outranks_more_recently_marked(
    client: TestClient, db: Session
) -> None:
    # A logged progress later than B was marked reading, so A leads even though
    # B is the more recently marked engagement.
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _create_engagement(client, book_a["id"])
    eng_b = _create_engagement(client, book_b["id"])
    _log_progress(client, eng_a["id"], 50)

    _set_updated_at(db, eng_a["id"], datetime.datetime(2024, 1, 1, tzinfo=datetime.UTC))
    _set_updated_at(db, eng_b["id"], datetime.datetime(2024, 6, 1, tzinfo=datetime.UTC))
    _set_logged_at(db, eng_a["id"], datetime.datetime(2024, 12, 1, tzinfo=datetime.UTC))

    data = client.get("/engagements?status=reading").json()
    assert [e["book"]["title"] for e in data] == ["Book A", "Book B"]


def test_list_reading_orders_multiple_logs_by_recency(
    client: TestClient, db: Session
) -> None:
    # Several logged books rank by which was logged most recently.
    engagements = {}
    for title in ("Book A", "Book B", "Book C"):
        book = _create_book(client, title=title, author=f"Author {title[-1]}")
        eng = _create_engagement(client, book["id"])
        _log_progress(client, eng["id"], 50)
        engagements[title] = eng["id"]

    marked = datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC)
    log_times = {
        "Book A": datetime.datetime(2024, 1, 1, tzinfo=datetime.UTC),
        "Book B": datetime.datetime(2024, 2, 1, tzinfo=datetime.UTC),
        "Book C": datetime.datetime(2024, 3, 1, tzinfo=datetime.UTC),
    }
    for title, eng_id in engagements.items():
        _set_updated_at(db, eng_id, marked)
        _set_logged_at(db, eng_id, log_times[title])

    data = client.get("/engagements?status=reading").json()
    assert [e["book"]["title"] for e in data] == ["Book C", "Book B", "Book A"]


def test_list_reading_order_stable_for_identical_activity(
    client: TestClient, db: Session
) -> None:
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _create_engagement(client, book_a["id"])
    eng_b = _create_engagement(client, book_b["id"])

    same = datetime.datetime(2024, 6, 1, tzinfo=datetime.UTC)
    _set_updated_at(db, eng_a["id"], same)
    _set_updated_at(db, eng_b["id"], same)

    first_order = [e["id"] for e in client.get("/engagements?status=reading").json()]
    second_order = [e["id"] for e in client.get("/engagements?status=reading").json()]
    assert first_order == second_order
