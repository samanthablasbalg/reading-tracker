from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.book import Book
from app.models.edition import Edition
from app.schemas.edition import EditionCreate, EditionRead, EditionUpdate

router = APIRouter(prefix="/editions", tags=["editions"])


@router.post("", response_model=EditionRead, status_code=status.HTTP_201_CREATED)
def create_edition(
    payload: EditionCreate, db: Session = Depends(get_db)
) -> EditionRead:
    if db.get(Book, payload.book_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    edition = Edition(
        book_id=payload.book_id,
        edition_format=payload.edition_format,
        isbn=payload.isbn,
        page_count=payload.page_count,
        cover_url=payload.cover_url,
    )
    db.add(edition)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT) from None
    db.refresh(edition)
    return EditionRead.model_validate(edition)


@router.get("/{edition_id}", response_model=EditionRead)
def get_edition(edition_id: uuid.UUID, db: Session = Depends(get_db)) -> EditionRead:
    edition = db.get(Edition, edition_id)
    if edition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return EditionRead.model_validate(edition)


@router.patch("/{edition_id}", response_model=EditionRead)
def update_edition(
    edition_id: uuid.UUID,
    payload: EditionUpdate,
    db: Session = Depends(get_db),
) -> EditionRead:
    edition = db.get(Edition, edition_id)
    if edition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    for field in payload.model_fields_set:
        setattr(edition, field, getattr(payload, field))

    db.commit()
    db.refresh(edition)
    return EditionRead.model_validate(edition)
