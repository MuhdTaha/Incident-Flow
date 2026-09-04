"""Shared constants for system actors and the default demo organization."""

from uuid import UUID

# Seeded by Alembic migration 2b1911bc8543
DEFAULT_ORG_ID = UUID("00000000-0000-0000-0000-000000000111")

DEMO_PERSONA_EMAILS = frozenset({
  "alex.admin@company.com",
  "sarah.ops@company.com",
  "jordan.dev@company.com",
})

# Stable UUID for the system bot user (created by demo seed if missing)
SYSTEM_BOT_ID = UUID("00000000-0000-0000-0000-000000000001")

SYSTEM_BOT_EMAIL = "system@incidentflow.local"
SYSTEM_BOT_NAME = "System Bot"
