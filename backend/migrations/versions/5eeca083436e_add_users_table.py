"""add_users_table

Revision ID: 5eeca083436e
Revises: b077b4bc8dd7
Create Date: 2026-07-14 17:57:19.734154

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5eeca083436e'
down_revision: Union[str, Sequence[str], None] = 'b077b4bc8dd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.execute(
        sa.text(
            "INSERT INTO users (id, email, created_at, updated_at) "
            "VALUES (gen_random_uuid(), :email, now(), now())"
        ).bindparams(email="blasbalgs@gmail.com")
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('users')
