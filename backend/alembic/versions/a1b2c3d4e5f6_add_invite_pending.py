"""add users.invite_pending

Revision ID: a1b2c3d4e5f6
Revises: 0ca9eb758cb9
Create Date: 2026-09-02 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "0ca9eb758cb9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column(
    "users",
    sa.Column("invite_pending", sa.Boolean(), nullable=False, server_default=sa.false()),
  )


def downgrade() -> None:
  op.drop_column("users", "invite_pending")
