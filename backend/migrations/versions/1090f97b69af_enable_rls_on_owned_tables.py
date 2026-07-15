"""enable_rls_on_owned_tables

Revision ID: 1090f97b69af
Revises: c84c377a8d6e
Create Date: 2026-07-15 15:38:26.143393

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '1090f97b69af'
down_revision: Union[str, Sequence[str], None] = 'c84c377a8d6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OWNED_TABLES = (
    "engagements",
    "standalone_entries",
    "blog_posts",
    "progress_logs",
    "reviews",
    "engagement_editions",
)


def upgrade() -> None:
    """Upgrade schema."""
    for table in OWNED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY user_isolation ON {table} "
            "USING (user_id = current_setting('app.current_user_id')::uuid) "
            "WITH CHECK (user_id = current_setting('app.current_user_id')::uuid)"
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table in OWNED_TABLES:
        op.execute(f"DROP POLICY user_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
