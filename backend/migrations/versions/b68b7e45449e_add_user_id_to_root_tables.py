"""add_user_id_to_root_tables

Revision ID: b68b7e45449e
Revises: 5eeca083436e
Create Date: 2026-07-14 21:15:34.902710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b68b7e45449e'
down_revision: Union[str, Sequence[str], None] = '5eeca083436e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_USER_EMAIL = "blasbalgs@gmail.com"

ROOT_TABLES = ("engagements", "standalone_entries", "blog_posts")


def upgrade() -> None:
    """Upgrade schema."""
    for table in ROOT_TABLES:
        op.add_column(table, sa.Column('user_id', sa.Uuid(), nullable=True))
        op.execute(
            sa.text(
                f"UPDATE {table} SET user_id = "
                "(SELECT id FROM users WHERE email = :email)"
            ).bindparams(email=SEED_USER_EMAIL)
        )
        op.alter_column(table, 'user_id', nullable=False)
        op.create_foreign_key(
            f"fk_{table}_user_id_users", table, 'users', ['user_id'], ['id']
        )

    op.create_unique_constraint(
        "uq_engagements_id_user_id", 'engagements', ['id', 'user_id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_engagements_id_user_id", 'engagements', type_='unique')

    for table in ROOT_TABLES:
        op.drop_constraint(f"fk_{table}_user_id_users", table, type_='foreignkey')
        op.drop_column(table, 'user_id')
