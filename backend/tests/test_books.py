from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.author import Author
from tests.conftest import engine


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
