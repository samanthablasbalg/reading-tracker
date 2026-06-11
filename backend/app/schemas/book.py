from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import DatePrecision


class BookCreate(BaseModel):
    title: str
    author: str


class AuthorRead(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class BookRead(BaseModel):
    id: uuid.UUID
    title: str
    authors: list[AuthorRead]
    google_books_id: str | None
    default_cover_url: str | None
    default_page_count: int | None
    original_language: str | None
    genres: list[str]
    publication_date: datetime.date | None
    publication_date_precision: DatePrecision
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
