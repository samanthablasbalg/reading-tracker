from __future__ import annotations

import functools
import uuid
from collections.abc import Callable
from typing import Any, cast

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.edition import Edition
from app.models.enums import Format


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


def _create_edition(
    client: TestClient,
    book_id: str,
    edition_format: str = "print",
    **kwargs: Any,
) -> dict[str, Any]:
    body = {"book_id": book_id, "edition_format": edition_format, **kwargs}
    response = client.post("/editions", json=body)
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _fake_volume(
    *,
    id: str = "abc123",
    title: str = "Piranesi",
    isbn_13: str | None = "9781526622426",
    page_count: int | None = 272,
    cover_url: str | None = "https://example.com/cover.jpg",
) -> dict[str, Any]:
    info: dict[str, Any] = {
        "title": title,
        "authors": ["Susanna Clarke"],
    }
    if isbn_13:
        info["industryIdentifiers"] = [{"type": "ISBN_13", "identifier": isbn_13}]
    if page_count is not None:
        info["pageCount"] = page_count
    if cover_url:
        info["imageLinks"] = {"thumbnail": cover_url}
    return {"id": id, "volumeInfo": info}


def _patch_google(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx2.Request], httpx2.Response],
) -> None:
    monkeypatch.setattr(
        "app.services.google_books.httpx2.Client",
        functools.partial(httpx2.Client, transport=httpx2.MockTransport(handler)),
    )


# --- Edition CRUD ---


def test_create_edition_returns_201(client: TestClient) -> None:
    book = _create_book(client)
    response = client.post(
        "/editions",
        json={
            "book_id": book["id"],
            "edition_format": "print",
            "isbn": "9781526622426",
            "page_count": 272,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["book_id"] == book["id"]
    assert data["edition_format"] == "print"
    assert data["isbn"] == "9781526622426"
    assert data["page_count"] == 272
    assert data["cover_url"] is None
    assert "id" in data
    assert "created_at" in data


def test_create_edition_unknown_book_returns_404(client: TestClient) -> None:
    response = client.post(
        "/editions",
        json={"book_id": str(uuid.uuid4()), "edition_format": "print"},
    )
    assert response.status_code == 404


def test_get_edition_returns_200(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")

    response = client.get(f"/editions/{edition['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == edition["id"]


def test_get_edition_unknown_returns_404(client: TestClient) -> None:
    response = client.get(f"/editions/{uuid.uuid4()}")
    assert response.status_code == 404


def test_update_edition_patches_only_sent_fields(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426", page_count=272)

    response = client.patch(
        f"/editions/{edition['id']}",
        json={"page_count": 300},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page_count"] == 300
    assert data["isbn"] == "9781526622426"


def test_update_edition_empty_body_changes_nothing(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426", page_count=272)

    response = client.patch(f"/editions/{edition['id']}", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["isbn"] == "9781526622426"
    assert data["page_count"] == 272


def test_update_edition_can_clear_isbn(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")

    response = client.patch(f"/editions/{edition['id']}", json={"isbn": None})
    assert response.status_code == 200
    assert response.json()["isbn"] is None


def test_update_edition_unknown_returns_404(client: TestClient) -> None:
    response = client.patch(f"/editions/{uuid.uuid4()}", json={"page_count": 100})
    assert response.status_code == 404


# --- Import seeds edition ---


def test_import_creates_print_edition_with_real_data(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db: Session,
) -> None:
    volume = _fake_volume(
        isbn_13="9781526622426",
        page_count=272,
        cover_url="https://example.com/cover.jpg",
    )

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    response = client.post("/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201

    book_id = uuid.UUID(response.json()["id"])
    editions = (
        db.execute(select(Edition).where(Edition.book_id == book_id)).scalars().all()
    )

    assert len(editions) == 1
    ed = editions[0]
    assert ed.edition_format == Format.print
    assert ed.isbn == "9781526622426"
    assert ed.page_count == 272
    assert ed.cover_url == "https://example.com/cover.jpg"


def test_import_creates_edition_with_null_isbn_when_no_identifiers(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db: Session,
) -> None:
    volume = _fake_volume(isbn_13=None)

    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=volume)

    _patch_google(monkeypatch, handler)

    response = client.post("/books/import", json={"google_books_id": "abc123"})
    assert response.status_code == 201

    book_id = uuid.UUID(response.json()["id"])
    editions = (
        db.execute(select(Edition).where(Edition.book_id == book_id)).scalars().all()
    )
    assert len(editions) == 1
    assert editions[0].isbn is None


# --- Bindings: create ---


def test_create_binding_by_edition_id_returns_201(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["edition"]["id"] == edition["id"]
    assert data["origin_id"] is None
    assert data["length_override"] is None


def test_create_binding_carries_length_override(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"], "length_override": 300},
    )
    assert response.status_code == 201
    assert response.json()["length_override"] == 300


def test_create_binding_by_format_finds_existing_edition(
    client: TestClient,
) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_format": "print"},
    )
    assert response.status_code == 201
    assert response.json()["edition"]["id"] == edition["id"]


def test_create_binding_by_format_no_edition_returns_404(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_format": "print"},
    )
    assert response.status_code == 404


def test_create_binding_by_format_multiple_editions_returns_409(
    client: TestClient,
) -> None:
    book = _create_book(client)
    _create_edition(client, book["id"], isbn="9781111111111")
    _create_edition(client, book["id"], isbn="9782222222222")
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_format": "print"},
    )
    assert response.status_code == 409


def test_create_binding_duplicate_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])
    client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"]},
    )

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"]},
    )
    assert response.status_code == 409


def test_create_binding_unknown_engagement_returns_404(
    client: TestClient,
) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")

    response = client.post(
        f"/engagements/{uuid.uuid4()}/editions",
        json={"edition_id": edition["id"]},
    )
    assert response.status_code == 404


def test_create_binding_unknown_edition_id_returns_404(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


def test_create_binding_both_resolvers_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"], "edition_format": "print"},
    )
    assert response.status_code == 422


def test_create_binding_no_resolver_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={},
    )
    assert response.status_code == 422


# --- Bindings: list ---


def test_list_bindings_returns_correct_editions(client: TestClient) -> None:
    book = _create_book(client)
    print_ed = _create_edition(client, book["id"], isbn="9781111111111")
    digital_ed = _create_edition(
        client, book["id"], edition_format="digital", isbn="9782222222222"
    )
    engagement = _create_engagement(client, book["id"])
    client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": print_ed["id"]},
    )
    client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": digital_ed["id"]},
    )

    response = client.get(f"/engagements/{engagement['id']}/editions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ids = {item["edition"]["id"] for item in data}
    assert ids == {print_ed["id"], digital_ed["id"]}


def test_list_bindings_empty(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.get(f"/engagements/{engagement['id']}/editions")
    assert response.status_code == 200
    assert response.json() == []


def test_list_bindings_unknown_engagement_returns_404(
    client: TestClient,
) -> None:
    response = client.get(f"/engagements/{uuid.uuid4()}/editions")
    assert response.status_code == 404


# --- Bindings: delete ---


def test_delete_binding_returns_204(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])
    client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"]},
    )

    response = client.delete(
        f"/engagements/{engagement['id']}/editions/{edition['id']}"
    )
    assert response.status_code == 204


def test_delete_binding_removes_it_from_list(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])
    client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": edition["id"]},
    )
    client.delete(f"/engagements/{engagement['id']}/editions/{edition['id']}")

    response = client.get(f"/engagements/{engagement['id']}/editions")
    assert response.json() == []


def test_delete_binding_unknown_returns_404(client: TestClient) -> None:
    book = _create_book(client)
    edition = _create_edition(client, book["id"], isbn="9781526622426")
    engagement = _create_engagement(client, book["id"])

    response = client.delete(
        f"/engagements/{engagement['id']}/editions/{edition['id']}"
    )
    assert response.status_code == 404


# --- Multiple bindings per engagement ---


def test_multiple_bindings_per_engagement(client: TestClient) -> None:
    book = _create_book(client)
    print_ed = _create_edition(client, book["id"], isbn="9781111111111")
    digital_ed = _create_edition(
        client, book["id"], edition_format="digital", isbn="9782222222222"
    )
    engagement = _create_engagement(client, book["id"])

    r1 = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": print_ed["id"], "length_override": 300},
    )
    r2 = client.post(
        f"/engagements/{engagement['id']}/editions",
        json={"edition_id": digital_ed["id"]},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["length_override"] == 300
    assert r2.json()["length_override"] is None

    bindings = client.get(f"/engagements/{engagement['id']}/editions").json()
    assert len(bindings) == 2
