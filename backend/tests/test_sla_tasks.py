import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.tasks import check_sla_breaches
from app.db.models import Incident, IncidentEvent, IncidentSeverity, IncidentStatus, Organization, User, UserRole


class _SessionProxy:
  """Reuse the test session; the task's finally block must not close it."""

  def __init__(self, inner):
    self._inner = inner

  def close(self):
    return None

  def __getattr__(self, name):
    return getattr(self._inner, name)


@pytest.fixture
def sla_org(db, client):
  org = Organization(
    id=uuid.uuid4(),
    name="SLA Test Org",
    slug=f"sla-test-org-{uuid.uuid4().hex[:8]}",
  )
  db.add(org)
  db.flush()
  return org


@pytest.fixture
def sla_owner(db, sla_org):
  user = User(
    id=uuid.uuid4(),
    email="sla-owner@testing.com",
    full_name="SLA Owner",
    role=UserRole.ENGINEER,
    organization_id=sla_org.id,
  )
  db.add(user)
  db.flush()
  return user


def _stale_detected_incident(db, sla_org, sla_owner, hours_old=3):
  incident = Incident(
    id=uuid.uuid4(),
    title="Gateway timeouts",
    description="SEV1 past SLA",
    severity=IncidentSeverity.SEV1,
    status=IncidentStatus.DETECTED,
    owner_id=sla_owner.id,
    organization_id=sla_org.id,
    created_at=datetime.now(timezone.utc) - timedelta(hours=hours_old),
  )
  db.add(incident)
  db.flush()
  return incident


def test_sla_escalates_stale_detected_incident(db, monkeypatch, sla_org, sla_owner):
  incident = _stale_detected_incident(db, sla_org, sla_owner)
  monkeypatch.setattr("app.core.tasks.SessionLocal", lambda: _SessionProxy(db))

  result = check_sla_breaches()

  db.refresh(incident)
  event = (
    db.query(IncidentEvent)
    .filter(IncidentEvent.incident_id == incident.id, IncidentEvent.event_type == "SLA_BREACH")
    .one()
  )

  assert "Escalated 1" in result
  assert incident.status == IncidentStatus.ESCALATED
  assert event.actor_id is None
  assert event.old_value == "DETECTED"
  assert event.new_value == "ESCALATED"


def test_sla_skips_fresh_detected_incident(db, monkeypatch, sla_org, sla_owner):
  incident = _stale_detected_incident(db, sla_org, sla_owner, hours_old=0)
  monkeypatch.setattr("app.core.tasks.SessionLocal", lambda: _SessionProxy(db))

  result = check_sla_breaches()

  db.refresh(incident)
  assert "Escalated 0" in result
  assert incident.status == IncidentStatus.DETECTED
  assert db.query(IncidentEvent).filter(IncidentEvent.incident_id == incident.id).count() == 0
