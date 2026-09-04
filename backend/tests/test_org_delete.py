import uuid
import pytest
from app.main import app
from app.api.deps import get_current_user
from app.db.models import (
  Organization,
  User,
  UserRole,
  Incident,
  IncidentEvent,
  IncidentAttachment,
  IncidentSeverity,
  IncidentStatus,
)


def _create_org(db, name="Delete Test Org", slug="delete-test-org"):
  org = Organization(id=uuid.uuid4(), name=name, slug=slug)
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


@pytest.fixture(autouse=True)
def no_external_io(monkeypatch):
  monkeypatch.setattr("app.services.org_service.delete_auth_user", lambda user_id: None)
  monkeypatch.setattr("app.services.org_service.delete_storage_keys", lambda *a, **k: None)


@pytest.fixture
def auth_override():
  yield
  app.dependency_overrides.pop(get_current_user, None)


def test_delete_org_forbidden_for_non_admin(client, db, auth_override):
  org = _create_org(db)
  engineer = _create_user(db, org.id, UserRole.ENGINEER, "eng@delete.com")
  app.dependency_overrides[get_current_user] = lambda: engineer

  response = client.request(
    "DELETE",
    "/api/v1/orgs/current",
    json={"name": org.name},
  )
  assert response.status_code == 403
  assert db.query(Organization).filter(Organization.id == org.id).first() is not None


def test_delete_org_requires_matching_name(client, db, auth_override):
  org = _create_org(db)
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin@delete.com")
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.request(
    "DELETE",
    "/api/v1/orgs/current",
    json={"name": "Wrong Name"},
  )
  assert response.status_code == 400
  assert db.query(Organization).filter(Organization.id == org.id).first() is not None
  assert db.query(User).filter(User.id == admin.id).first() is not None


def test_delete_org_rejects_demo_workspace(client, db, auth_override, monkeypatch):
  org_id = uuid.uuid4()
  monkeypatch.setattr("app.services.org_service.DEFAULT_ORG_ID", org_id)
  org = Organization(id=org_id, name="Default Org", slug="default-org")
  db.add(org)
  admin = _create_user(db, org.id, UserRole.ADMIN, "alex.admin@company.com")
  db.commit()
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.request(
    "DELETE",
    "/api/v1/orgs/current",
    json={"name": "Default Org"},
  )
  assert response.status_code == 403
  assert db.query(Organization).filter(Organization.id == org.id).first() is not None


def test_delete_org_removes_members_incidents_and_auth(client, db, auth_override, monkeypatch):
  org = _create_org(db, name="Acme", slug="acme-delete")
  other = _create_org(db, name="Other Org", slug="other-delete")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin@acme.com")
  engineer = _create_user(db, org.id, UserRole.ENGINEER, "eng@acme.com")
  outsider = _create_user(db, other.id, UserRole.ADMIN, "admin@other.com")

  incident = Incident(
    id=uuid.uuid4(),
    title="Outage",
    description="SEV1",
    severity=IncidentSeverity.SEV1,
    status=IncidentStatus.DETECTED,
    owner_id=engineer.id,
    organization_id=org.id,
  )
  db.add(incident)
  db.flush()
  db.add(
    IncidentEvent(
      id=uuid.uuid4(),
      incident_id=incident.id,
      actor_id=engineer.id,
      event_type="COMMENT",
      comment="Looking into it",
      organization_id=org.id,
    )
  )
  db.add(
    IncidentAttachment(
      id=uuid.uuid4(),
      incident_id=incident.id,
      file_name="log.txt",
      file_key=f"incidents/{incident.id}/log.txt",
      uploaded_by=engineer.id,
      organization_id=org.id,
    )
  )
  other_incident = Incident(
    id=uuid.uuid4(),
    title="Keep me",
    description="other",
    severity=IncidentSeverity.SEV3,
    status=IncidentStatus.DETECTED,
    owner_id=outsider.id,
    organization_id=other.id,
  )
  db.add(other_incident)
  db.commit()

  admin_id = str(admin.id)
  engineer_id = str(engineer.id)
  incident_id = incident.id
  org_id = org.id
  other_id = other.id
  outsider_id = outsider.id
  other_incident_id = other_incident.id

  deleted_auth = []
  deleted_keys = []
  monkeypatch.setattr(
    "app.services.org_service.delete_auth_user",
    lambda user_id: deleted_auth.append(user_id),
  )
  monkeypatch.setattr(
    "app.services.org_service.delete_storage_keys",
    lambda keys, prefixes=None: deleted_keys.append((list(keys), prefixes)),
  )

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.request(
    "DELETE",
    "/api/v1/orgs/current",
    json={"name": "Acme"},
  )

  assert response.status_code == 200
  assert response.json()["message"] == "Workspace deleted"
  assert db.query(Organization).filter(Organization.id == org_id).first() is None
  assert db.query(User).filter(User.organization_id == org_id).first() is None
  assert db.query(Incident).filter(Incident.organization_id == org_id).first() is None
  assert db.query(IncidentEvent).filter(IncidentEvent.organization_id == org_id).first() is None
  assert db.query(IncidentAttachment).filter(IncidentAttachment.organization_id == org_id).first() is None

  assert db.query(Organization).filter(Organization.id == other_id).first() is not None
  assert db.query(User).filter(User.id == outsider_id).first() is not None
  assert db.query(Incident).filter(Incident.id == other_incident_id).first() is not None

  assert set(deleted_auth) == {admin_id, engineer_id}
  assert deleted_keys
  assert f"incidents/{incident_id}/log.txt" in deleted_keys[0][0]
  assert deleted_keys[0][1] == [f"orgs/{org_id}/"]
