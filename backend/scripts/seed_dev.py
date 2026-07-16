#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from typing import cast

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

DATABASE_URL = os.environ["DATABASE_URL"]
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")


def _request(
    method: str, path: str, body: dict[str, object] | None = None
) -> dict[str, object]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE_URL}/api{path}",
        data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return cast(dict[str, object], json.loads(resp.read()))
    except urllib.error.URLError as exc:
        print(f"Could not reach the backend at {BASE_URL}. Is it running?")
        raise SystemExit(1) from exc


def post(path: str, body: dict[str, object]) -> dict[str, object]:
    return _request("POST", path, body)


def patch(path: str, body: dict[str, object]) -> None:
    _request("PATCH", path, body)


def reset() -> None:
    print("Resetting database...")
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tablename FROM pg_tables"
                " WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
            )
            tables = ", ".join(row[0] for row in cur.fetchall())
            if tables:
                cur.execute(f"TRUNCATE {tables} CASCADE")
            cur.execute(
                "INSERT INTO users (id, email, created_at, updated_at) "
                "VALUES (gen_random_uuid(), 'blasbalgs@gmail.com', now(), now())"
            )


_cover_urls: dict[str, str] = {}


def add_book(title: str, author: str, page_count: int, cover_url: str) -> str:
    b = post("/books", {"title": title, "author": author, "page_count": page_count})
    book_id = str(b["id"])
    _cover_urls[book_id] = cover_url
    post(
        "/editions",
        {"book_id": book_id, "edition_format": "print", "page_count": page_count},
    )
    post(
        "/editions",
        {"book_id": book_id, "edition_format": "digital", "page_count": page_count},
    )
    post("/editions", {"book_id": book_id, "edition_format": "audio"})
    return book_id


def apply_cover_urls() -> None:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            for book_id, url in _cover_urls.items():
                cur.execute(
                    "UPDATE books SET default_cover_url = %s WHERE id = %s",
                    (url, book_id),
                )


def start_reading(
    book_id: str, fmt: str, audio_length_minutes: int | None = None
) -> str:
    body: dict[str, object] = {"book_id": book_id, "edition_format": fmt}
    if audio_length_minutes is not None:
        body["audio_length_minutes"] = audio_length_minutes
    return str(post("/engagements", body)["id"])


def log_progress(engagement_id: str, current_page: int) -> None:
    post(f"/engagements/{engagement_id}/progress-logs", {"current_page": current_page})


def log_audio_progress(engagement_id: str, current_minute: int) -> None:
    post(
        f"/engagements/{engagement_id}/progress-logs",
        {"current_minute": current_minute},
    )


def finish(engagement_id: str) -> None:
    patch(f"/engagements/{engagement_id}", {"status": "finished"})


def dnf(engagement_id: str) -> None:
    patch(f"/engagements/{engagement_id}", {"status": "dnf"})


reset()
print("Seeding...")

# Catalog only
add_book(
    "The Remains of the Day",
    "Kazuo Ishiguro",
    258,
    "http://books.google.com/books/content?id=MSurBex2xcUC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
)
add_book(
    "Mexican Gothic",
    "Silvia Moreno-Garcia",
    320,
    "http://books.google.com/books/content?id=ksKyDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
)
add_book(
    "Educated",
    "Tara Westover",
    352,
    "http://books.google.com/books/content?id=JZwpDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
)

# Currently reading — with progress
eng = start_reading(
    add_book(
        "Piranesi",
        "Susanna Clarke",
        272,
        "http://books.google.com/books/content?id=zaXg0AEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
    ),
    "print",
)
log_progress(eng, 68)
log_progress(eng, 142)

eng = start_reading(
    add_book(
        "Babel",
        "R.F. Kuang",
        546,
        "http://books.google.com/books/content?id=YMpQEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
    ),
    "digital",
)
log_progress(eng, 120)

# Currently reading — audio, with progress
eng = start_reading(
    add_book(
        "The House in the Cerulean Sea",
        "TJ Klune",
        394,
        "http://books.google.com/books/content?id=O0iSDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
    ),
    "audio",
    audio_length_minutes=600,
)
log_audio_progress(eng, 180)

# Finished
finish(
    start_reading(
        add_book(
            "Normal People",
            "Sally Rooney",
            273,
            "http://books.google.com/books/content?id=fQBlDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
        ),
        "print",
    )
)

# DNF
eng = start_reading(
    add_book(
        "Infinite Jest",
        "David Foster Wallace",
        1079,
        "http://books.google.com/books/content?id=Nhe2yvx6hP8C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
    ),
    "print",
)
log_progress(eng, 97)
dnf(eng)

apply_cover_urls()
print("Done. 8 books seeded.")
