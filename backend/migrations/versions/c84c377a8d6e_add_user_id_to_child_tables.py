"""add_user_id_to_child_tables

Revision ID: c84c377a8d6e
Revises: b68b7e45449e
Create Date: 2026-07-14 21:28:55.764617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c84c377a8d6e'
down_revision: Union[str, Sequence[str], None] = 'b68b7e45449e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHILD_TABLES = {
    "progress_logs": "progress_logs_engagement_id_fkey",
    "reviews": "reviews_engagement_id_fkey",
    "engagement_editions": "engagement_editions_engagement_id_fkey",
}


def upgrade() -> None:
    """Upgrade schema."""
    for table, old_fk_name in CHILD_TABLES.items():
        op.add_column(table, sa.Column('user_id', sa.Uuid(), nullable=True))
        op.execute(
            sa.text(
                f"UPDATE {table} SET user_id = engagements.user_id "
                f"FROM engagements WHERE {table}.engagement_id = engagements.id"
            )
        )
        op.alter_column(table, 'user_id', nullable=False)
        op.drop_constraint(old_fk_name, table, type_='foreignkey')
        op.create_foreign_key(
            f"fk_{table}_engagement_id_user_id_engagements",
            table,
            'engagements',
            ['engagement_id', 'user_id'],
            ['id', 'user_id'],
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table, old_fk_name in CHILD_TABLES.items():
        op.drop_constraint(
            f"fk_{table}_engagement_id_user_id_engagements", table, type_='foreignkey'
        )
        op.create_foreign_key(old_fk_name, table, 'engagements', ['engagement_id'], ['id'])
        op.drop_column(table, 'user_id')
