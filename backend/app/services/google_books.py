from __future__ import annotations

import dataclasses
import os
import time
from typing import Any

import httpx2

_BASE_URL = "https://www.googleapis.com/books/v1"
_MAX_ATTEMPTS = 3
_RETRY_DELAY_SECONDS = 0.3


class GoogleBooksError(Exception):
    pass


@dataclasses.dataclass
class GoogleVolume:
    google_books_id: str
    title: str
    authors: list[str]
    published_date: str | None
    page_count: int | None
    categories: list[str]
    cover_url: str | None
    language: str | None
    isbn: str | None


def _api_key_params() -> dict[str, str]:
    key = os.getenv("GOOGLE_BOOKS_API_KEY")
    return {"key": key} if key else {}


def _extract_isbn(identifiers: list[dict[str, str]]) -> str | None:
    by_type = {entry["type"]: entry["identifier"] for entry in identifiers}
    return by_type.get("ISBN_13") or by_type.get("ISBN_10")


def _https_url(url: str | None) -> str | None:
    if url and url.startswith("http://"):
        return "https://" + url.removeprefix("http://")
    return url


def _parse_volume(item: dict[str, Any]) -> GoogleVolume:
    info: dict[str, Any] = item.get("volumeInfo", {})
    image_links: dict[str, Any] = info.get("imageLinks", {})
    return GoogleVolume(
        google_books_id=item["id"],
        title=info.get("title", ""),
        authors=info.get("authors", []),
        published_date=info.get("publishedDate"),
        page_count=info.get("pageCount"),
        categories=info.get("categories", []),
        cover_url=_https_url(image_links.get("thumbnail")),
        language=info.get("language"),
        isbn=_extract_isbn(info.get("industryIdentifiers", [])),
    )


def _get_with_retry(url: str, params: dict[str, str]) -> httpx2.Response:
    """GET with retries on transient failures (connection errors, 5xx).

    Google's API is prone to brief, unpredictable 503s ("backendFailed") that clear up
    within a request or two.
    """
    last_transport_error: httpx2.TransportError | None = None
    response: httpx2.Response | None = None

    for attempt in range(_MAX_ATTEMPTS):
        try:
            with httpx2.Client() as client:
                response = client.get(url, params=params)
        except httpx2.TransportError as exc:
            last_transport_error = exc
            response = None
        else:
            if response.status_code < 500:
                return response

        if attempt < _MAX_ATTEMPTS - 1:
            time.sleep(_RETRY_DELAY_SECONDS)

    if response is None:
        raise GoogleBooksError("Google Books unreachable") from last_transport_error
    return response


def search_volumes(q: str) -> list[GoogleVolume]:
    response = _get_with_retry(f"{_BASE_URL}/volumes", {"q": q, **_api_key_params()})
    if response.status_code != 200:
        raise GoogleBooksError(f"Google Books search returned {response.status_code}")
    data: dict[str, Any] = response.json()
    return [_parse_volume(item) for item in data.get("items", [])]


def get_volume(volume_id: str) -> GoogleVolume | None:
    response = _get_with_retry(f"{_BASE_URL}/volumes/{volume_id}", _api_key_params())
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise GoogleBooksError(
            f"Google Books volume fetch returned {response.status_code}"
        )
    return _parse_volume(response.json())
