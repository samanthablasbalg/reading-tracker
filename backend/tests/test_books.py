from __future__ import annotations

import functools
from collections.abc import Callable
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.author import Author
from tests.conftest import engine


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

    response = client.get("/books/search?q=piranesi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    candidate = data[0]
    assert candidate["google_books_id"] == "abc123"
    assert candidate["title"] == "Piranesi"
    assert candidate["authors"] == ["Susanna Clarke"]
    assert candidate["published_date"] == "2020-09-15"
    assert candidate["page_count"] == 272
    assert candidate["categories"] == ["Fantasy"]
    assert candidate["cover_url"] == "https://example.com/cover.jpg"
    assert candidate["language"] == "en"


def test_search_empty_results(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={})

    _patch_google(monkeypatch, handler)

    response = client.get("/books/search?q=zzznomatch")
    assert response.status_code == 200
    assert response.json() == []


def test_search_empty_q_returns_422(client: TestClient) -> None:
    response = client.get("/books/search?q=")
    assert response.status_code == 422


def test_import_book_returns_201(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    volume = _fake_volume(authors=["Susanna Clarke"], categories=["Fantasy"])

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    response = client.post("/books/import", json={"google_books_id": "abc123"})
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

    first = client.post("/books/import", json={"google_books_id": "abc123"})
    assert first.status_code == 201

    second = client.post("/books/import", json={"google_books_id": "abc123"})
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    from app.models.book import Book

    with Session(_engine) as db:
        books = db.execute(select(Book)).scalars().all()
    assert len(books) == 1


def test_import_date_precision_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020-09-15"))

    _patch_google(monkeypatch, handler)

    data = client.post("/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-09-15"
    assert data["publication_date_precision"] == "day"


def test_import_date_precision_month(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020-09"))

    _patch_google(monkeypatch, handler)

    data = client.post("/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-09-01"
    assert data["publication_date_precision"] == "month"


def test_import_date_precision_year(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_fake_volume(published_date="2020"))

    _patch_google(monkeypatch, handler)

    data = client.post("/books/import", json={"google_books_id": "abc123"}).json()
    assert data["publication_date"] == "2020-01-01"
    assert data["publication_date_precision"] == "year"


def test_import_unknown_id_returns_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(404)

    _patch_google(monkeypatch, handler)

    response = client.post("/books/import", json={"google_books_id": "doesnotexist"})
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

    client.post("/books/import", json={"google_books_id": "id1"})
    client.post("/books/import", json={"google_books_id": "id2"})

    with Session(_engine) as db:
        authors = db.execute(select(Author)).scalars().all()
    assert len(authors) == 1


def test_import_upstream_failure_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(500)

    _patch_google(monkeypatch, handler)

    response = client.post("/books/import", json={"google_books_id": "abc123"})
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

    response = client.post("/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201
    data = response.json()
    assert data["authors"] == []
    assert data["default_page_count"] is None
    assert data["default_cover_url"] is None
    assert data["genres"] == []


def test_create_book_returns_created(client: TestClient) -> None:
    response = client.post(
        "/books",
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


def test_create_book_reuses_existing_author(client: TestClient) -> None:
    client.post(
        "/books", json={"title": "A Memory Called Empire", "author": "Arkady Martine"}
    )
    client.post(
        "/books",
        json={"title": "A Desolation Called Peace", "author": "Arkady Martine"},
    )

    with Session(engine) as db:
        authors = db.execute(select(Author)).scalars().all()
    assert len(authors) == 1


def test_list_books_returns_all(client: TestClient) -> None:
    client.post(
        "/books", json={"title": "A Memory Called Empire", "author": "Arkady Martine"}
    )
    client.post("/books", json={"title": "Piranesi", "author": "Susanna Clarke"})

    response = client.get("/books")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    titles = {book["title"] for book in data}
    assert titles == {"A Memory Called Empire", "Piranesi"}


def test_list_books_empty(client: TestClient) -> None:
    response = client.get("/books")
    assert response.status_code == 200
    assert response.json() == []
