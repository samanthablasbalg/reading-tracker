from __future__ import annotations

import datetime

from sqlalchemy.orm import Session

from app.crud import CRUDBase
from app.exceptions import ConflictError, NotFoundError
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.edition import Edition
from app.models.enums import BookAuthorRole, DatePrecision, Format
from app.services.google_books import get_volume

book_crud = CRUDBase(Book)
author_crud = CRUDBase(Author)
book_author_crud = CRUDBase(BookAuthor)
edition_crud = CRUDBase(Edition)


def create_book(
    db: Session,
    *,
    title: str,
    authors: list[str],
    page_count: int | None = None,
    google_books_id: str | None = None,
    cover_url: str | None = None,
    language: str | None = None,
    genres: list[str] | None = None,
    publication_date: datetime.date | None = None,
    publication_date_precision: DatePrecision | None = None,
) -> Book:
    book = book_crud.create(
        db,
        Book(
            title=title,
            default_page_count=page_count,
            google_books_id=google_books_id,
            default_cover_url=cover_url,
            original_language=language,
            genres=genres or [],
            publication_date=publication_date,
            publication_date_precision=publication_date_precision or DatePrecision.day,
        ),
    )
    for name in authors:
        author = author_crud.get_or_create(db, lookup={"name": name})
        book_author_crud.create(
            db,
            BookAuthor(
                book_id=book.id, author_id=author.id, role=BookAuthorRole.author
            ),
        )
    return book


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


def import_book_from_google(db: Session, *, google_books_id: str) -> tuple[Book, bool]:
    existing = book_crud.get_by(db, google_books_id=google_books_id)
    if existing is not None:
        return existing, False

    volume = get_volume(google_books_id)
    if volume is None:
        raise NotFoundError(f"No Google Books volume found for id {google_books_id}")

    pub_date, pub_precision = _parse_published_date(volume.published_date)

    book = create_book(
        db,
        title=volume.title,
        authors=volume.authors,
        page_count=volume.page_count,
        google_books_id=volume.google_books_id,
        cover_url=volume.cover_url,
        language=volume.language,
        genres=volume.categories,
        publication_date=pub_date,
        publication_date_precision=pub_precision,
    )

    edition_crud.create(
        db,
        Edition(
            book_id=book.id,
            edition_format=Format.print,
            isbn=volume.isbn,
            page_count=volume.page_count,
            cover_url=volume.cover_url,
        ),
    )
    edition_crud.create(
        db,
        Edition(
            book_id=book.id,
            edition_format=Format.digital,
            page_count=volume.page_count,
            cover_url=volume.cover_url,
        ),
    )
    edition_crud.create(
        db,
        Edition(
            book_id=book.id, edition_format=Format.audio, cover_url=volume.cover_url
        ),
    )

    return book, True


def remove_book(db: Session, book: Book) -> None:
    if book.engagements or book.standalone_entries:
        raise ConflictError("Remove its engagements first.")
    book_crud.delete(db, book)


def capture_audio_length(book: Book, edition: Edition, length: int) -> None:
    if book.default_audio_minutes is None:
        book.default_audio_minutes = length
    if edition.audio_minutes is None:
        edition.audio_minutes = length
