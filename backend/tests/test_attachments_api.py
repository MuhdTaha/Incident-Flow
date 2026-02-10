import uuid
import pytest
from app.main import app
from app.api.deps import get_current_user
from app.db.models import Organization, User, UserRole, Incident, IncidentStatus, IncidentSeverity, IncidentAttachment
from app.core import storage
from app.services import attachment_service


@pytest.fixture
def test_organization(db):
  org = Organization(
    id=uuid.uuid4(),
    name="Attachment Test Org",
    slug="attachment-test-org",
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
def uploader_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ENGINEER, "uploader@files.com")


@pytest.fixture
def other_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ENGINEER, "other@files.com")


@pytest.fixture
def admin_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ADMIN, "admin@files.com")


@pytest.fixture
def incident(db, test_organization, uploader_user):
  inc = Incident(
    id=uuid.uuid4(),
    title="Attach Test",
    description="Attachment test",
    severity=IncidentSeverity.SEV2,
    status=IncidentStatus.DETECTED,
    owner_id=uploader_user.id,
    organization_id=test_organization.id
  )
  db.add(inc)
  db.commit()
  db.refresh(inc)
  return inc


@pytest.fixture
def auth_override():
  yield
  app.dependency_overrides.pop(get_current_user, None)


def test_sign_upload_returns_key_and_data(client, auth_override, uploader_user, incident, monkeypatch):
  fake_data = {"url": "http://example.com", "fields": {"key": "value"}}

  def fake_presign(object_name):
    return fake_data

  monkeypatch.setattr(attachment_service, "create_presigned_post", fake_presign)

  app.dependency_overrides[get_current_user] = lambda: uploader_user
  response = client.post(
    f"/api/v1/incidents/{incident.id}/attachments/sign",
    json={"file_name": "error log.txt", "file_type": "text/plain"}
  )

  assert response.status_code == 200
  data = response.json()
  assert data["data"] == fake_data
  assert str(incident.id) in data["file_key"]
  assert "error_log.txt" in data["file_key"]


def test_complete_upload_and_list(client, db, auth_override, uploader_user, incident):
  app.dependency_overrides[get_current_user] = lambda: uploader_user

  response = client.post(
    f"/api/v1/incidents/{incident.id}/attachments/complete",
    json={"file_name": "evidence.png", "file_key": f"incidents/{incident.id}/evidence.png"}
  )
  assert response.status_code == 200

  response = client.get(f"/api/v1/incidents/{incident.id}/attachments")
  assert response.status_code == 200
  data = response.json()
  assert len(data) == 1
  assert data[0]["file_name"] == "evidence.png"
  assert data[0]["uploaded_by"] == uploader_user.full_name


def test_list_attachments_missing_incident(client, auth_override, uploader_user):
  app.dependency_overrides[get_current_user] = lambda: uploader_user
  response = client.get(f"/api/v1/incidents/{uuid.uuid4()}/attachments")
  assert response.status_code == 404


def test_delete_attachment_rbac(client, db, auth_override, uploader_user, other_user, admin_user, incident, monkeypatch):
  class DummyS3:
    def delete_object(self, Bucket, Key):
      return None

  monkeypatch.setattr(storage, "get_s3_client", lambda: DummyS3())

  attachment = IncidentAttachment(
    id=uuid.uuid4(),
    incident_id=incident.id,
    organization_id=incident.organization_id,
    file_name="runbook.pdf",
    file_key=f"incidents/{incident.id}/runbook.pdf",
    uploaded_by=uploader_user.id
  )
  db.add(attachment)
  db.commit()
  db.refresh(attachment)

  app.dependency_overrides[get_current_user] = lambda: other_user
  response = client.delete(f"/api/v1/incidents/{incident.id}/attachments/{attachment.id}")
  assert response.status_code == 403

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.delete(f"/api/v1/incidents/{incident.id}/attachments/{attachment.id}")
  assert response.status_code == 200
