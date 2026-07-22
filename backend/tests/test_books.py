from __future__ import annotations

import datetime
import functools
import uuid
from collections.abc import Callable
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.edition import Edition
from app.models.enums import Format
from app.models.standalone_entry import StandaloneEntry
from app.models.user import User
from tests.conftest import owner_engine
from tests.helpers import (
    _create_bare_book,
    _create_book,
    _create_edition,
    _create_engagement,
)


def _fake_volume(
    *,
    id: str = "abc123",
    title: str = "Piranesi",
    authors: list[str] | None = None,
    published_date: str | None = "2020-09-15",
    page_count: int | None = 272,
    categories: list[str] | None = None,
    cover_url: str | None = "https://example.com/cover.jpg",
    language: str | None = "en",
) -> dict[str, Any]:
    info: dict[str, Any] = {"title": title}
    if authors is not None:
        info["authors"] = authors
    if published_date is not None:
        info["publishedDate"] = published_date
    if page_count is not None:
        info["pageCount"] = page_count
    if categories is not None:
        info["categories"] = categories
    if cover_url is not None:
        info["imageLinks"] = {"thumbnail": cover_url}
    if language is not None:
        info["language"] = language
    return {"id": id, "volumeInfo": info}


def _patch_google(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx2.Request], httpx2.Response],
) -> None:
    monkeypatch.setattr(
        "app.services.google_books.httpx2.Client",
        functools.partial(httpx2.Client, transport=httpx2.MockTransport(handler)),
    )


def test_search_returns_candidates(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(authors=["Susanna Clarke"], categories=["Fantasy"])

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"items": [volume]})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    candidate = data[0]
    assert candidate["state"] == "not_in_app"
    assert candidate["book_id"] is None
    assert candidate["status"] is None
    assert candidate["google_books_id"] == "abc123"
    assert candidate["title"] == "Piranesi"
    assert candidate["authors"] == ["Susanna Clarke"]
    assert candidate["published_date"] == "2020-09-15"
    assert candidate["page_count"] == 272
    assert candidate["categories"] == ["Fantasy"]
    assert candidate["cover_url"] == "https://example.com/cover.jpg"
    assert candidate["language"] == "en"


def test_search_book_in_catalog_not_in_library(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    book = _create_bare_book(client, title="Piranesi", author="Susanna Clarke")

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["state"] == "in_catalog"
    assert data[0]["book_id"] == book["id"]
    assert data[0]["status"] is None


def test_search_book_in_library_shows_status(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    book = _create_book(client, title="Piranesi", author="Susanna Clarke")
    _create_engagement(client, book["id"])

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["state"] == "in_library"
    assert data[0]["status"] == "reading"


def test_search_matches_local_book_by_author_name(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _create_bare_book(client, title="Piranesi", author="Susanna Clarke")

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=clarke")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_search_prefers_reading_status_when_multiple_engagements(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    book = _create_book(client, title="Piranesi", author="Susanna Clarke")
    finished = _create_engagement(client, book["id"])
    client.patch(f"/api/engagements/{finished['id']}", json={"status": "finished"})
    client.post(
        "/api/engagements", json={"book_id": book["id"], "edition_format": "audio"}
    )

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.json()[0]["status"] == "reading"


def test_search_falls_back_to_most_recent_status(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    book = _create_book(client, title="Piranesi", author="Susanna Clarke")
    first = _create_engagement(client, book["id"])
    client.patch(f"/api/engagements/{first['id']}", json={"status": "dnf"})
    second = client.post(
        "/api/engagements", json={"book_id": book["id"], "edition_format": "audio"}
    ).json()
    client.patch(f"/api/engagements/{second['id']}", json={"status": "finished"})

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.json()[0]["status"] == "finished"


def test_search_dedups_google_hit_already_in_catalog_by_google_books_id(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(id="abc123", authors=["Susanna Clarke"])

    def import_handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, import_handler)
    client.post("/api/books/import", json={"google_books_id": "abc123"})

    def search_handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"items": [volume]})

    _patch_google(monkeypatch, search_handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["state"] == "in_catalog"
    assert data[0]["google_books_id"] == "abc123"


def test_search_dedups_google_hit_matching_local_isbn(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    book = _create_bare_book(client, title="Piranesi", author="Susanna Clarke")
    _create_edition(client, book["id"], isbn="9781526622426")

    volume = _fake_volume(id="differentid", authors=["Susanna Clarke"])
    volume["volumeInfo"]["industryIdentifiers"] = [
        {"type": "ISBN_13", "identifier": "9781526622426"}
    ]

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"items": [volume]})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["state"] == "in_catalog"


def test_search_google_failure_degrades_to_local_results(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _create_bare_book(client, title="Piranesi", author="Susanna Clarke")

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(500)

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["state"] == "in_catalog"


def test_search_google_failure_with_no_local_results_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(500)

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=zzznomatch")
    assert response.status_code == 502


def test_search_retries_transient_5xx_and_succeeds(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(authors=["Susanna Clarke"])
    attempts = {"count": 0}

    def handler(request: httpx2.Request) -> httpx2.Response:
        attempts["count"] += 1
        if attempts["count"] < 3:
            return httpx2.Response(503, json={"error": {"message": "backendFailed"}})
        return httpx2.Response(200, json={"items": [volume]})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    assert attempts["count"] == 3
    assert response.json()[0]["google_books_id"] == "abc123"


def test_search_upgrades_http_cover_to_https(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(cover_url="http://books.google.com/books/content?id=x&img=1")

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"items": [volume]})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=piranesi")
    assert response.status_code == 200
    candidate = response.json()[0]
    assert candidate["cover_url"] == "https://books.google.com/books/content?id=x&img=1"


def test_search_empty_results(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/api/books/search?q=zzznomatch")
    assert response.status_code == 200
    assert response.json() == []


def test_search_empty_q_returns_422(client: TestClient) -> None:
    response = client.get("/api/books/search?q=")
    assert response.status_code == 422


def test_import_book_returns_201(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(authors=["Susanna Clarke"], categories=["Fantasy"])

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    response = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Piranesi"
    assert data["google_books_id"] == "abc123"
    assert data["default_cover_url"] == "https://example.com/cover.jpg"
    assert data["default_page_count"] == 272
    assert data["original_language"] == "en"
    assert data["genres"] == ["Fantasy"]
    assert data["publication_date"] == "2020-09-15"
    assert len(data["authors"]) == 1
    assert data["authors"][0]["name"] == "Susanna Clarke"


def test_import_already_in_catalog_returns_200_no_duplicate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(authors=["Susanna Clarke"], categories=["Fantasy"])

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    first = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert first.status_code == 201

    second = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    with Session(owner_engine) as db:
        books = db.execute(select(Book)).scalars().all()
    assert len(books) == 1


def test_import_date_precision_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020-09-15"))

    _patch_google(monkeypatch, handler)

    data = client.post("/api/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-09-15"
    assert data["publication_date_precision"] == "day"


def test_import_date_precision_month(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020-09"))

    _patch_google(monkeypatch, handler)

    data = client.post("/api/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-09-01"
    assert data["publication_date_precision"] == "month"


def test_import_date_precision_year(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020"))

    _patch_google(monkeypatch, handler)

    data = client.post("/api/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-01-01"
    assert data["publication_date_precision"] == "year"


def test_import_unknown_id_returns_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(404)

    _patch_google(monkeypatch, handler)

    response = client.post(
        "/api/books/import", json={"google_books_id": "doesnotexist"}
    )
    assert response.status_code == 404


def test_import_reuses_existing_author(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        volume_id = request.url.path.split("/")[-1]
        return httpx2.Response(
            200,
            json=_fake_volume(
                id=volume_id,
                title="Book A" if volume_id == "id1" else "Book B",
                authors=["Susanna Clarke"],
            ),
        )

    _patch_google(monkeypatch, handler)

    client.post("/api/books/import", json={"google_books_id": "id1"})
    client.post("/api/books/import", json={"google_books_id": "id2"})

    with Session(owner_engine) as db:
        authors = db.execute(select(Author)).scalars().all()
    assert len(authors) == 1


def test_import_seeds_three_editions(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    volume = _fake_volume(
        authors=["Susanna Clarke"],
        page_count=272,
        cover_url="https://example.com/cover.jpg",
    )

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    response = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201
    book_id = uuid.UUID(response.json()["id"])

    editions = (
        db.execute(select(Edition).where(Edition.book_id == book_id)).scalars().all()
    )
    assert len(editions) == 3

    by_format = {e.edition_format: e for e in editions}
    assert set(by_format.keys()) == {Format.print, Format.digital, Format.audio}

    print_ed = by_format[Format.print]
    assert print_ed.page_count == 272
    assert print_ed.cover_url == "https://example.com/cover.jpg"

    digital_ed = by_format[Format.digital]
    assert digital_ed.page_count == 272
    assert digital_ed.cover_url == "https://example.com/cover.jpg"
    assert digital_ed.isbn is None

    audio_ed = by_format[Format.audio]
    assert audio_ed.page_count is None
    assert audio_ed.cover_url == "https://example.com/cover.jpg"
    assert audio_ed.isbn is None


def test_import_upstream_failure_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(500)

    _patch_google(monkeypatch, handler)

    response = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 502


def test_import_missing_optional_fields(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json=_fake_volume(
                authors=None,
                page_count=None,
                cover_url=None,
                categories=None,
            ),
        )

    _patch_google(monkeypatch, handler)

    response = client.post("/api/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201
    data = response.json()
    assert data["authors"] == []
    assert data["default_page_count"] is None
    assert data["default_cover_url"] is None
    assert data["genres"] == []


def test_create_book_returns_created(client: TestClient) -> None:
    response = client.post(
        "/api/books",
        json={"title": "A Desolation Called Peace", "author": "Arkady Martine"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "A Desolation Called Peace"
    assert len(data["authors"]) == 1
    assert data["authors"][0]["name"] == "Arkady Martine"
    assert "id" in data
    assert "created_at" in data
    assert data["google_books_id"] is None
    assert data["default_cover_url"] is None
    assert data["default_page_count"] is None
    assert data["original_language"] is None
    assert data["genres"] == []
    assert data["publication_date"] is None


@pytest.mark.parametrize(
    "title,author",
    [
        ("", "Arkady Martine"),
        ("   ", "Arkady Martine"),
        ("A Memory Called Empire", ""),
        ("A Memory Called Empire", "   "),
    ],
)
def test_create_book_rejects_blank_fields(
    client: TestClient, title: str, author: str
) -> None:
    response = client.post("/api/books", json={"title": title, "author": author})
    assert response.status_code == 422


def test_create_book_reuses_existing_author(client: TestClient) -> None:
    client.post(
        "/api/books",
        json={"title": "A Memory Called Empire", "author": "Arkady Martine"},
    )
    client.post(
        "/api/books",
        json={"title": "A Desolation Called Peace", "author": "Arkady Martine"},
    )

    with Session(owner_engine) as db:
        authors = db.execute(select(Author)).scalars().all()
    assert len(authors) == 1


def test_list_books_returns_all(client: TestClient) -> None:
    client.post(
        "/api/books",
        json={"title": "A Memory Called Empire", "author": "Arkady Martine"},
    )
    client.post("/api/books", json={"title": "Piranesi", "author": "Susanna Clarke"})

    response = client.get("/api/books")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    titles = {book["title"] for book in data}
    assert titles == {"A Memory Called Empire", "Piranesi"}


def test_list_books_empty(client: TestClient) -> None:
    response = client.get("/api/books")
    assert response.status_code == 200
    assert response.json() == []


# --- Delete book ---


def test_delete_book_returns_204(client: TestClient) -> None:
    book = _create_book(client)

    response = client.delete(f"/api/books/{book['id']}")
    assert response.status_code == 204


def test_delete_book_removes_it_from_list(client: TestClient) -> None:
    book = _create_book(client)

    client.delete(f"/api/books/{book['id']}")

    response = client.get("/api/books")
    assert response.status_code == 200
    assert all(b["id"] != book["id"] for b in response.json())


def test_delete_book_cascades_editions_and_authors(
    client: TestClient, db: Session
) -> None:
    book = _create_book(client)
    book_id = uuid.UUID(book["id"])

    client.delete(f"/api/books/{book['id']}")

    editions = (
        db.execute(select(Edition).where(Edition.book_id == book_id)).scalars().all()
    )
    assert editions == []

    book_authors = (
        db.execute(select(BookAuthor).where(BookAuthor.book_id == book_id))
        .scalars()
        .all()
    )
    assert book_authors == []


def test_delete_book_with_engagement_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    _create_engagement(client, book["id"])

    response = client.delete(f"/api/books/{book['id']}")
    assert response.status_code == 409


def test_delete_book_with_engagement_leaves_book_intact(client: TestClient) -> None:
    book = _create_book(client)
    _create_engagement(client, book["id"])

    client.delete(f"/api/books/{book['id']}")

    response = client.get("/api/books")
    assert any(b["id"] == book["id"] for b in response.json())


def test_delete_book_with_standalone_entry_returns_409(
    client: TestClient, db: Session, seed_user: User
) -> None:
    book = _create_bare_book(client)
    book_id = uuid.UUID(book["id"])
    db.add(
        StandaloneEntry(
            book_id=book_id,
            user_id=seed_user.id,
            read_on=datetime.date(2026, 1, 1),
        )
    )
    db.commit()

    response = client.delete(f"/api/books/{book['id']}")
    assert response.status_code == 409


def test_delete_unknown_book_returns_404(client: TestClient) -> None:
    response = client.delete(f"/api/books/{uuid.uuid4()}")
    assert response.status_code == 404
