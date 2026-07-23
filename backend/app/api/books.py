from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.engagement import Engagement
from app.models.enums import DatePrecision, ReadingStatus
from app.models.user import User
from app.schemas import (
    BookCreate,
    BookImportRequest,
    BookRead,
    BookSearchResult,
)
from app.services import books as book_service
from app.services.google_books import GoogleBooksError, search_volumes

router = APIRouter(prefix="/books", tags=["books"])

_BOOK_READ_OPTIONS = (selectinload(Book.book_authors).selectinload(BookAuthor.author),)


def _reload(db: Session, book_id: uuid.UUID) -> Book:
    book = book_service.book_crud.get(db, book_id, options=_BOOK_READ_OPTIONS)
    assert book is not None
    return book


def _to_book_read(book: Book) -> BookRead:
    return BookRead.model_validate(book)


def _format_published_date(book: Book) -> str | None:
    if book.publication_date is None:
        return None
    if book.publication_date_precision == DatePrecision.year:
        return str(book.publication_date.year)
    if book.publication_date_precision == DatePrecision.month:
        return book.publication_date.strftime("%Y-%m")
    return book.publication_date.isoformat()


def _pick_status(
    engagements: list[Engagement],
) -> Literal["reading", "finished", "dnf"]:
    reading = next((e for e in engagements if e.status == ReadingStatus.reading), None)
    if reading is not None:
        return cast(Literal["reading", "finished", "dnf"], reading.status.value)
    latest = max(engagements, key=lambda e: e.updated_at)
    return cast(Literal["reading", "finished", "dnf"], latest.status.value)


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(payload: BookCreate, db: Session = Depends(get_db)) -> BookRead:
    book = book_service.create_book(
        db, title=payload.title, authors=[payload.author], page_count=payload.page_count
    )
    db.commit()
    return _to_book_read(_reload(db, book.id))


def _engagements_by_book(
    db: Session, book_ids: list[uuid.UUID], user_id: uuid.UUID
) -> dict[uuid.UUID, list[Engagement]]:
    if not book_ids:
        return {}
    engagements = (
        db.execute(
            select(Engagement).where(
                Engagement.book_id.in_(book_ids), Engagement.user_id == user_id
            )
        )
        .scalars()
        .all()
    )
    grouped: dict[uuid.UUID, list[Engagement]] = {}
    for engagement in engagements:
        grouped.setdefault(engagement.book_id, []).append(engagement)
    return grouped


def _local_search_results(
    local_books: Sequence[Book],
    engagements_by_book: dict[uuid.UUID, list[Engagement]],
) -> tuple[list[BookSearchResult], set[str], set[str]]:
    results: list[BookSearchResult] = []
    seen_google_ids: set[str] = set()
    seen_isbns: set[str] = set()

    for book in local_books:
        book_engagements = engagements_by_book.get(book.id, [])
        results.append(
            BookSearchResult(
                state="in_library" if book_engagements else "in_catalog",
                book_id=book.id,
                google_books_id=book.google_books_id,
                title=book.title,
                authors=[author.name for author in book.authors],
                published_date=_format_published_date(book),
                page_count=book.default_page_count,
                categories=book.genres,
                cover_url=book.default_cover_url,
                language=book.original_language,
                status=_pick_status(book_engagements) if book_engagements else None,
            )
        )
        if book.google_books_id:
            seen_google_ids.add(book.google_books_id)
        for edition in book.editions:
            if edition.isbn:
                seen_isbns.add(edition.isbn)

    return results, seen_google_ids, seen_isbns


def _not_in_app_results(
    q: str,
    seen_google_ids: set[str],
    seen_isbns: set[str],
    *,
    has_local_results: bool,
) -> list[BookSearchResult]:
    try:
        volumes = search_volumes(q)
    except GoogleBooksError as exc:
        if not has_local_results:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY) from exc
        return []

    results: list[BookSearchResult] = []
    for volume in volumes:
        if volume.google_books_id in seen_google_ids:
            continue
        if volume.isbn is not None and volume.isbn in seen_isbns:
            continue
        results.append(
            BookSearchResult(
                state="not_in_app",
                book_id=None,
                google_books_id=volume.google_books_id,
                title=volume.title,
                authors=volume.authors,
                published_date=volume.published_date,
                page_count=volume.page_count,
                categories=volume.categories,
                cover_url=volume.cover_url,
                language=volume.language,
                status=None,
            )
        )
    return results


@router.get("/search", response_model=list[BookSearchResult])
def search_books(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookSearchResult]:
    pattern = f"%{q}%"
    local_books = (
        db.execute(
            select(Book)
            .distinct()
            .outerjoin(BookAuthor, BookAuthor.book_id == Book.id)
            .outerjoin(Author, Author.id == BookAuthor.author_id)
            .where(or_(Book.title.ilike(pattern), Author.name.ilike(pattern)))
            .options(
                selectinload(Book.book_authors).selectinload(BookAuthor.author),
                selectinload(Book.editions),
            )
        )
        .scalars()
        .all()
    )

    engagements_by_book = _engagements_by_book(
        db, [book.id for book in local_books], current_user.id
    )
    results, seen_google_ids, seen_isbns = _local_search_results(
        local_books, engagements_by_book
    )
    results += _not_in_app_results(
        q, seen_google_ids, seen_isbns, has_local_results=bool(results)
    )
    return results


@router.post("/import", response_model=BookRead, status_code=status.HTTP_200_OK)
def import_book(
    payload: BookImportRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> BookRead:
    try:
        book, created = book_service.import_book_from_google(
            db, google_books_id=payload.google_books_id
        )
    except GoogleBooksError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY) from exc

    db.commit()
    if created:
        response.status_code = status.HTTP_201_CREATED
    return _to_book_read(_reload(db, book.id))


@router.get("", response_model=list[BookRead])
def list_books(db: Session = Depends(get_db)) -> list[BookRead]:
    books = book_service.book_crud.list(db, options=_BOOK_READ_OPTIONS)
    return [_to_book_read(book) for book in books]


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    book = book_service.book_crud.get_or_raise(db, book_id)
    book_service.remove_book(db, book)
    db.commit()
