from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.edition import Edition
from app.models.enums import BookAuthorRole, DatePrecision, Format
from app.schemas.book import (
    AuthorRead,
    BookCreate,
    BookImportRequest,
    BookRead,
    BookSearchCandidate,
)
from app.services.google_books import (
    GoogleBooksError,
    get_volume,
    search_volumes,
)

router = APIRouter(prefix="/books", tags=["books"])


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
    return BookRead(
        id=book.id,
        title=book.title,
        authors=[AuthorRead.model_validate(ba.author) for ba in book.book_authors],
        google_books_id=book.google_books_id,
        default_cover_url=book.default_cover_url,
        default_page_count=book.default_page_count,
        original_language=book.original_language,
        genres=book.genres,
        publication_date=book.publication_date,
        publication_date_precision=book.publication_date_precision,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


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


@router.get("/search", response_model=list[BookSearchCandidate])
def search_books(q: str = Query(min_length=1)) -> list[BookSearchCandidate]:
    try:
        volumes = search_volumes(q)
    except GoogleBooksError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY) from exc
    return [
        BookSearchCandidate(
            google_books_id=v.google_books_id,
            title=v.title,
            authors=v.authors,
            published_date=v.published_date,
            page_count=v.page_count,
            categories=v.categories,
            cover_url=v.cover_url,
            language=v.language,
        )
        for v in volumes
    ]


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
