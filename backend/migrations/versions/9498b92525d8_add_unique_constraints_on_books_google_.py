"""add unique constraints on books.google_books_id and authors.name

Revision ID: 9498b92525d8
Revises: feb620ee13b3
Create Date: 2026-06-11 19:27:13.285150

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9498b92525d8'
down_revision: Union[str, Sequence[str], None] = 'feb620ee13b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint('uq_authors_name', 'authors', ['name'])
    op.create_unique_constraint('uq_books_google_books_id', 'books', ['google_books_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_books_google_books_id', 'books', type_='unique')
    op.drop_constraint('uq_authors_name', 'authors', type_='unique')
