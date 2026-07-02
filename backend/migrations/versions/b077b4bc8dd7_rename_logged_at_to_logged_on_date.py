"""rename_logged_at_to_logged_on_date

Revision ID: b077b4bc8dd7
Revises: 7e7227e66103
Create Date: 2026-06-28 20:23:18.028269

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b077b4bc8dd7"
down_revision: Union[str, Sequence[str], None] = "7e7227e66103"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "progress_logs",
        "logged_at",
        new_column_name="logged_on",
        type_=sa.Date(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        postgresql_using="logged_at::date",
    )


def downgrade() -> None:
    op.alter_column(
        "progress_logs",
        "logged_on",
        new_column_name="logged_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.Date(),
        existing_nullable=False,
        postgresql_using="logged_on::timestamptz",
    )
