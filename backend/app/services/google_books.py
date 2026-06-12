from __future__ import annotations

import dataclasses
import os
from typing import Any

import httpx2

_BASE_URL = "https://www.googleapis.com/books/v1"


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


def _api_key_params() -> dict[str, str]:
    key = os.getenv("GOOGLE_BOOKS_API_KEY")
    return {"key": key} if key else {}


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
        cover_url=image_links.get("thumbnail"),
        language=info.get("language"),
    )


def search_volumes(q: str) -> list[GoogleVolume]:
    try:
        with httpx2.Client() as client:
            response = client.get(
                f"{_BASE_URL}/volumes", params={"q": q, **_api_key_params()}
            )
    except httpx2.TransportError as exc:
        raise GoogleBooksError("Google Books unreachable") from exc
    if response.status_code != 200:
        raise GoogleBooksError(f"Google Books search returned {response.status_code}")
    data: dict[str, Any] = response.json()
    return [_parse_volume(item) for item in data.get("items", [])]


def get_volume(volume_id: str) -> GoogleVolume | None:
    try:
        with httpx2.Client() as client:
            response = client.get(
                f"{_BASE_URL}/volumes/{volume_id}", params=_api_key_params()
            )
    except httpx2.TransportError as exc:
        raise GoogleBooksError("Google Books unreachable") from exc
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise GoogleBooksError(
            f"Google Books volume fetch returned {response.status_code}"
        )
    return _parse_volume(response.json())
