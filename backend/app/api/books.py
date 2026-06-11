from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.enums import BookAuthorRole
from app.schemas.book import AuthorRead, BookCreate, BookRead

router = APIRouter(prefix="/books", tags=["books"])


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
    author = db.execute(
        select(Author).where(Author.name == payload.author)
    ).scalar_one_or_none()
    if author is None:
        author = Author(name=payload.author)
        db.add(author)
        db.flush()

    book = Book(title=payload.title)
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
