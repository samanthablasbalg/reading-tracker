from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, ConfigDict


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
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
