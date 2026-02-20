import uuid
import pytest
from app.main import app
from app.api.deps import get_current_user
from app.db.models import Organization, User, UserRole, Incident, IncidentStatus, IncidentSeverity
from app.repositories.analytics_repo import AnalyticsRepository


@pytest.fixture
def test_organization(db):
  org = Organization(
    id=uuid.uuid4(),
    name="Admin Test Org",
    slug="admin-test-org",
  )
  db.add(org)
  db.commit()
  db.refresh(org)
  return org


def _create_user(db, org_id, role, email):
  user = User(
    id=uuid.uuid4(),
    email=email,
    full_name=email.split("@")[0].title(),
    role=role,
    organization_id=org_id,
  )
  db.add(user)
  db.flush()
  db.refresh(user)
  return user


@pytest.fixture
def admin_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ADMIN, "admin@admin.com")


@pytest.fixture
def engineer_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ENGINEER, "eng@admin.com")


@pytest.fixture
def auth_override():
  yield
  app.dependency_overrides.pop(get_current_user, None)


def test_admin_stats_requires_admin(client, auth_override, engineer_user):
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.get("/api/v1/admin/stats")
  assert response.status_code == 403


def test_admin_stats_counts(client, db, auth_override, admin_user, test_organization, monkeypatch): # <-- Added monkeypatch here
  other_user = _create_user(db, test_organization.id, UserRole.MANAGER, "mgr@admin.com")

  inc1 = Incident(
    id=uuid.uuid4(),
    title="Outage",
    description="SEV1 outage",
    severity=IncidentSeverity.SEV1,
    status=IncidentStatus.DETECTED,
    owner_id=admin_user.id,
    organization_id=test_organization.id
  )
  inc2 = Incident(
    id=uuid.uuid4(),
    title="Latency",
    description="SEV2 issue",
    severity=IncidentSeverity.SEV2,
    status=IncidentStatus.CLOSED,
    owner_id=other_user.id,
    organization_id=test_organization.id
  )
  db.add_all([inc1, inc2])
  db.commit()

  # --- Mock the raw SQL method to bypass SQLite's UUID issues ---
  class DummyRow:
    def __init__(self, u, assigned, resolved):
      self.id = u.id
      self.full_name = u.full_name
      self.email = u.email
      self.role = u.role.value if hasattr(u.role, 'value') else str(u.role)
      self.assigned_incidents = assigned
      self.resolved_incidents = resolved
      self.comments_made = 0
      self.breached_incidents = 0
      self.escalations_triggered = 0

  def fake_detailed_stats(self, org_id):
    return [
      DummyRow(admin_user, 1, 0),
      DummyRow(other_user, 1, 1)
    ]
      
  monkeypatch.setattr(AnalyticsRepository, "get_detailed_user_stats", fake_detailed_stats)
  # -------------------------------------------------------------------

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/admin/stats")

  assert response.status_code == 200
  data = response.json()
  assert data["total_users"] == 2
  assert data["total_incidents"] == 2
  assert data["active_incidents"] == 1
  assert data["incidents_by_severity"]["SEV1"] == 1
  assert data["incidents_by_severity"]["SEV2"] == 1
  assert len(data["user_performance"]) == 2

def test_admin_analytics_response(client, db, auth_override, admin_user, test_organization, monkeypatch):
  # 1. Update the fake functions to accept the 'days' parameter
  def fake_mttr_seconds(self, org_id, days=30): 
    return 7200
  
  def fake_mtta_seconds(self, org_id, days=30): 
    return 1800
  
  def fake_sla_rate(self, org_id, days=30): 
    return {"total": 1, "breached": 0, "breach_rate": 0.0}

  # 2. Mock ALL the Postgres-heavy database methods
  monkeypatch.setattr(AnalyticsRepository, "calculate_mttr_seconds", fake_mttr_seconds)
  monkeypatch.setattr(AnalyticsRepository, "calculate_mtta_seconds", fake_mtta_seconds)
  monkeypatch.setattr(AnalyticsRepository, "calculate_sla_breach_rate", fake_sla_rate)

  inc = Incident(
    id=uuid.uuid4(),
    title="Investigate",
    description="SEV3 issue",
    severity=IncidentSeverity.SEV3,
    status=IncidentStatus.RESOLVED,
    owner_id=admin_user.id,
    organization_id=test_organization.id
  )
  db.add(inc)
  db.commit()

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/admin/charts")

  assert response.status_code == 200
  data = response.json()
  assert data["mttr_hours"] == 2.0
  # Verify the newly added metrics exist in the response
  assert data["mtta_minutes"] == 30.0 
  assert isinstance(data["volume_trend"], list)