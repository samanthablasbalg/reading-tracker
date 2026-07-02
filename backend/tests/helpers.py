from __future__ import annotations

from typing import Any, cast

from fastapi.testclient import TestClient


def _create_book(
    client: TestClient,
    title: str = "Piranesi",
    author: str = "Susanna Clarke",
) -> dict[str, Any]:
    response = client.post("/books", json={"title": title, "author": author})
    assert response.status_code == 201
    book = cast(dict[str, Any], response.json())
    client.post("/editions", json={"book_id": book["id"], "edition_format": "print"})
    client.post("/editions", json={"book_id": book["id"], "edition_format": "digital"})
    client.post("/editions", json={"book_id": book["id"], "edition_format": "audio"})
    return book


def _create_bare_book(
    client: TestClient,
    title: str = "Piranesi",
    author: str = "Susanna Clarke",
) -> dict[str, Any]:
    response = client.post("/books", json={"title": title, "author": author})
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _create_engagement(
    client: TestClient, book_id: str, started_on: str | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"book_id": book_id, "edition_format": "print"}
    if started_on is not None:
        body["started_on"] = started_on
    response = client.post("/engagements", json=body)
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _log_progress(
    client: TestClient,
    engagement_id: str,
    current_page: int,
    logged_on: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"current_page": current_page}
    if logged_on is not None:
        body["logged_on"] = logged_on
    response = client.post(f"/engagements/{engagement_id}/progress-logs", json=body)
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _create_edition(
    client: TestClient,
    book_id: str,
    edition_format: str = "print",
    **kwargs: Any,
) -> dict[str, Any]:
    response = client.post(
        "/editions",
        json={"book_id": book_id, "edition_format": edition_format, **kwargs},
    )
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _bind_edition(
    client: TestClient,
    engagement_id: str,
    edition_id: str,
    **kwargs: Any,
) -> dict[str, Any]:
    response = client.post(
        f"/engagements/{engagement_id}/editions",
        json={"edition_id": edition_id, **kwargs},
    )
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _create_audio_engagement(
    client: TestClient, book_id: str, started_on: str | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"book_id": book_id, "edition_format": "audio"}
    if started_on is not None:
        body["started_on"] = started_on
    response = client.post("/engagements", json=body)
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _log_audio_progress(
    client: TestClient,
    engagement_id: str,
    current_minute: int,
    logged_on: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {"current_minute": current_minute, **kwargs}
    if logged_on is not None:
        body["logged_on"] = logged_on
    response = client.post(f"/engagements/{engagement_id}/progress-logs", json=body)
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())
