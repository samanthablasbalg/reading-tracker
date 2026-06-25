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


def _create_engagement(client: TestClient, book_id: str) -> dict[str, Any]:
    response = client.post(
        "/engagements", json={"book_id": book_id, "edition_format": "print"}
    )
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


def _create_audio_engagement(client: TestClient, book_id: str) -> dict[str, Any]:
    response = client.post(
        "/engagements", json={"book_id": book_id, "edition_format": "audio"}
    )
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _log_audio_progress(
    client: TestClient,
    engagement_id: str,
    current_minute: int,
    **kwargs: Any,
) -> dict[str, Any]:
    response = client.post(
        f"/engagements/{engagement_id}/progress-logs",
        json={"current_minute": current_minute, **kwargs},
    )
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())
