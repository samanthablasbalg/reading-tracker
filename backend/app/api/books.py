from __future__ import annotations

import datetime
import uuid
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.edition import Edition
from app.models.engagement import Engagement
from app.models.enums import BookAuthorRole, DatePrecision, Format, ReadingStatus
from app.models.user import User
from app.schemas import (
    BookCreate,
    BookImportRequest,
    BookRead,
    BookSearchResult,
)
from app.services.google_books import (
    GoogleBooksError,
    get_volume,
    search_volumes,
)

router = APIRouter(prefix="/books", tags=["books"])


_LOAD_OPTIONS = (selectinload(Book.book_authors).selectinload(BookAuthor.author),)


def _parse_published_date(
    raw: str | None,
) -> tuple[datetime.date | None, DatePrecision | None]:
    if not raw:
        return None, None
    if len(raw) == 4:
        return datetime.date(int(raw), 1, 1), DatePrecision.year
    if len(raw) == 7:
        year, month = raw.split("-")
        return datetime.date(int(year), int(month), 1), DatePrecision.month
    return datetime.datetime.strptime(raw, "%Y-%m-%d").date(), DatePrecision.day


def _get_or_create_author(name: str, db: Session) -> Author:
    author = db.execute(select(Author).where(Author.name == name)).scalar_one_or_none()
    if author is None:
        author = Author(name=name)
        db.add(author)
        db.flush()
    return author


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


def _fetch(book_id: uuid.UUID, db: Session) -> Book:
    book = db.execute(
        select(Book).where(Book.id == book_id).options(*_LOAD_OPTIONS)
    ).scalar_one_or_none()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return book


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(payload: BookCreate, db: Session = Depends(get_db)) -> BookRead:
    author = _get_or_create_author(payload.author, db)

    book = Book(title=payload.title, default_page_count=payload.page_count)
    db.add(book)
    db.flush()

    db.add(BookAuthor(book_id=book.id, author_id=author.id, role=BookAuthorRole.author))
    db.commit()

    loaded = db.execute(
        select(Book)
        .where(Book.id == book.id)
        .options(selectinload(Book.book_authors).selectinload(BookAuthor.author))
    ).scalar_one()

    return _to_book_read(loaded)


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

    book_ids = [book.id for book in local_books]
    engagements = (
        db.execute(
            select(Engagement).where(
                Engagement.book_id.in_(book_ids),
                Engagement.user_id == current_user.id,
            )
        )
        .scalars()
        .all()
        if book_ids
        else []
    )
    engagements_by_book: dict[uuid.UUID, list[Engagement]] = {}
    for engagement in engagements:
        engagements_by_book.setdefault(engagement.book_id, []).append(engagement)

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

    try:
        volumes = search_volumes(q)
    except GoogleBooksError as exc:
        if not results:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY) from exc
        volumes = []

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


@router.post("/import", response_model=BookRead, status_code=status.HTTP_200_OK)
def import_book(
    payload: BookImportRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> BookRead:
    existing = db.execute(
        select(Book)
        .where(Book.google_books_id == payload.google_books_id)
        .options(selectinload(Book.book_authors).selectinload(BookAuthor.author))
    ).scalar_one_or_none()
    if existing:
        return _to_book_read(existing)

    try:
        volume = get_volume(payload.google_books_id)
    except GoogleBooksError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY) from exc
    if volume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    pub_date, pub_precision = _parse_published_date(volume.published_date)

    book = Book(
        title=volume.title,
        google_books_id=volume.google_books_id,
        default_cover_url=volume.cover_url,
        default_page_count=volume.page_count,
        original_language=volume.language,
        genres=volume.categories,
        publication_date=pub_date,
        publication_date_precision=pub_precision or DatePrecision.day,
    )
    db.add(book)
    db.flush()

    for name in volume.authors:
        author = _get_or_create_author(name, db)
        db.add(
            BookAuthor(book_id=book.id, author_id=author.id, role=BookAuthorRole.author)
        )

    db.add(
        Edition(
            book_id=book.id,
            edition_format=Format.print,
            isbn=volume.isbn,
            page_count=volume.page_count,
            cover_url=volume.cover_url,
        )
    )
    db.add(
        Edition(
            book_id=book.id,
            edition_format=Format.digital,
            page_count=volume.page_count,
            cover_url=volume.cover_url,
        )
    )
    db.add(
        Edition(
            book_id=book.id,
            edition_format=Format.audio,
            cover_url=volume.cover_url,
        )
    )

    db.commit()

    loaded = db.execute(
        select(Book)
        .where(Book.id == book.id)
        .options(selectinload(Book.book_authors).selectinload(BookAuthor.author))
    ).scalar_one()

    response.status_code = status.HTTP_201_CREATED
    return _to_book_read(loaded)


@router.get("", response_model=list[BookRead])
def list_books(db: Session = Depends(get_db)) -> list[BookRead]:
    books = (
        db.execute(
            select(Book).options(
                selectinload(Book.book_authors).selectinload(BookAuthor.author)
            )
        )
        .scalars()
        .all()
    )
    return [_to_book_read(book) for book in books]


@router.get("/{book_id}", response_model=BookRead)
def get_book(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> BookRead:
    return BookRead.model_validate(_fetch(book_id, db))


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if book.engagements or book.standalone_entries:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Remove its engagements first.",
        )

    db.delete(book)
    db.commit()
