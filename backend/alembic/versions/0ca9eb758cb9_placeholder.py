"""noop placeholder for a local alembic stamp that was never committed

Revision ID: 0ca9eb758cb9
Revises: e854b3007360
Create Date: 2026-09-02 04:45:00.000000

"""
from typing import Sequence, Union


revision: str = "0ca9eb758cb9"
down_revision: Union[str, Sequence[str], None] = "e854b3007360"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  pass


def downgrade() -> None:
  pass
