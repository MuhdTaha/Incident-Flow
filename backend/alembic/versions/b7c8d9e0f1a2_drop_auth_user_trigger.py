"""stop auth trigger from inserting default-org members

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-09-03 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.execute(
    """
    DO $$
    BEGIN
      IF to_regclass('auth.users') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      END IF;
    END $$;
    """
  )
  op.execute("DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE")


def downgrade() -> None:
  pass
