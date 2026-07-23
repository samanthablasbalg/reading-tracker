from app.models.author import Author
from app.models.book import Book, BookAuthor
from app.models.edition import Edition, EngagementEdition
from app.models.engagement import Engagement
from app.models.progress_log import ProgressLog
from app.models.review import Review
from app.models.user import User

from .crud_base import CRUDBase

__all__ = [
    "CRUDBase",
    "author_crud",
    "book_author_crud",
    "book_crud",
    "edition_crud",
    "engagement_crud",
    "engagement_edition_crud",
    "progress_log_crud",
    "review_crud",
    "user_crud",
]

author_crud = CRUDBase(Author)
book_crud = CRUDBase(Book)
book_author_crud = CRUDBase(BookAuthor)
edition_crud = CRUDBase(Edition)
engagement_crud = CRUDBase(Engagement)
engagement_edition_crud = CRUDBase(EngagementEdition)
progress_log_crud = CRUDBase(ProgressLog)
review_crud = CRUDBase(Review)
user_crud = CRUDBase(User)
