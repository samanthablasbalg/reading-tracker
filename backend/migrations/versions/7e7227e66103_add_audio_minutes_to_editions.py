"""add_audio_minutes_to_editions

Revision ID: 7e7227e66103
Revises: a6487dbbdea0
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '7e7227e66103'
down_revision: Union[str, Sequence[str], None] = 'a6487dbbdea0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('editions', sa.Column('audio_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('editions', 'audio_minutes')
