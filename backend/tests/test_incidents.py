# backend/tests/test_incidents.py
import pytest
import uuid
from app.main import app
from app.db.session import get_db
from app.db.models import User, UserRole, IncidentStatus, Incident, Organization
from app.api.deps import get_current_user

# --- Fixtures ---

@pytest.fixture
def test_organization(db):
  """Seeds a dummy organization to populate other tables."""
  org = Organization(
    id=uuid.uuid4(),
    name="Test Org",
    slug="test-org",
  )
  db.add(org)
  db.commit()
  db.refresh(org)
  return org

@pytest.fixture
def engineer_user(db, test_organization):
  """Creates a standard ENGINEER user."""
  user = User(
    id=uuid.uuid4(),
    email="eng@testing.com", 
    full_name="Software Engineer",
    role=UserRole.ENGINEER,
    organization_id=test_organization.id
  )
  db.add(user)
  db.flush()
  db.refresh(user)
  return user

@pytest.fixture
def admin_user(db, test_organization):
  """Creates a standard ADMIN user."""
  user = User(
    id=uuid.uuid4(),
    email="admin@testing.com", 
    full_name="Tech Lead",
    role=UserRole.ADMIN,
    organization_id=test_organization.id
  )
  db.add(user)
  db.flush()
  db.refresh(user)
  return user

@pytest.fixture
def incident_id(db, engineer_user, test_organization):
  """Seeds a single incident to test against."""
  inc = Incident(
    title="Database Latency",
    description="High latency on primary DB",
    severity="SEV2",
    owner_id=engineer_user.id,
    status=IncidentStatus.DETECTED,
    organization_id=test_organization.id
  )
  db.add(inc)
  db.commit() # Commit so it exists for the client requests
  return str(inc.id)

def test_read_main(client):
  response = client.get("/")
  assert response.status_code == 404 # Since we don't have a root route

def test_create_incident_requires_auth(client):
  # Try to create without a token -> Should fail
  response = client.post(
    "/api/v1/incidents",
    json={"title": "Test", "description": "Test", "severity": "SEV4", "organization_id": "00000000000000000000000000000111"},
  )
  assert response.status_code == 401 # Unauthorized access
  
def test_create_incident(client, db, engineer_user, test_organization):
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  # Create an incident
  response = client.post(
    "/api/v1/incidents",
    json={
      "title": "API Test Incident",
      "description": "Testing incident creation via API",
      "severity": "SEV3",
      "organization_id": str(test_organization.id)
    },
  )
  assert response.status_code == 200
  data = response.json()
  assert data["title"] == "API Test Incident"
  assert data["description"] == "Testing incident creation via API"
  assert data["severity"] == "SEV3"
  assert data["status"] == "DETECTED"
  
def test_update_incident_status(client, db, engineer_user, incident_id):
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  # Transition the incident to INVESTIGATING
  transition_payload = {
     "new_state": "INVESTIGATING",
     "comment": "Starting investigation now.",
   }
  response = client.post(f"/api/v1/incidents/{incident_id}/transition", json=transition_payload)
  assert response.status_code == 200
  assert response.json()["status"] == "INVESTIGATING"
  
def test_update_incident_severity(client, db, engineer_user, admin_user, incident_id):
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: admin_user
  
  # Update severity to SEV1
  response = client.patch(
    f"/api/v1/incidents/{incident_id}",
    json={"severity": "SEV1"}
  )
  assert response.status_code == 200
  assert response.json()["severity"] == "SEV1"
  
  # Check Audit Logs for the severity change
  response = client.get(f"/api/v1/incidents/{incident_id}/events")
  assert response.status_code == 200
  events = response.json()
  assert any(e["event_type"] == "SEVERITY_CHANGE" for e in events)
  assert any(e["old_value"] == "SEV2" for e in events)
  assert any(e["new_value"] == "SEV1" for e in events)
  assert any(e["comment"] == "SEVERITY_CHANGE from SEV2 to SEV1" for e in events)
  
def test_update_incident_assignee(client, db, engineer_user, admin_user, incident_id):
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: admin_user
  
  # Assign the incident to admin user
  response = client.patch(
    f"/api/v1/incidents/{incident_id}",
    json={"owner_id": str(admin_user.id)}
  )
  assert response.status_code == 200
  assert response.json()["owner_id"] == str(admin_user.id)
  
  # Check Audit Logs for the assignee change
  response = client.get(f"/api/v1/incidents/{incident_id}/events")
  assert response.status_code == 200
  events = response.json()
  assert any(e["event_type"] == "OWNER_CHANGE" for e in events)
  assert any(e["old_value"] == str(engineer_user.id) for e in events)
  assert any(e["new_value"] == str(admin_user.id) for e in events)
  assert any(e["comment"] == "OWNER_CHANGE from {} to {}".format(str(engineer_user.id), str(admin_user.id)) for e in events)
  
def test_update_incident_full(client, db, engineer_user, admin_user, incident_id):
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  # Update all fields
  response = client.patch(
    f"/api/v1/incidents/{incident_id}",
    json={
      "severity": "SEV1",
      "owner_id": str(admin_user.id)
    }
  )
  assert response.status_code == 403 # Should fail since Engineer can't assign to others
  
  # Now override Auth to be the Admin
  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.patch(
    f"/api/v1/incidents/{incident_id}",
    json={
      "severity": "SEV1",
      "owner_id": str(admin_user.id)
    }
  )
  assert response.status_code == 200
  assert response.json()["severity"] == "SEV1"
  assert response.json()["owner_id"] == str(admin_user.id)