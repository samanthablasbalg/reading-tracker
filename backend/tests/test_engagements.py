from __future__ import annotations

import uuid
from typing import Any, cast

from fastapi.testclient import TestClient


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
