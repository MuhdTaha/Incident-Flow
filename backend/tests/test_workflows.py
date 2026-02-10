# backend/tests/test_workflows.py
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

# --- Tests ---

def test_full_incident_lifecycle(client, db, engineer_user, incident_id):
  """
  Tests the flow: Transition -> Comment -> Verify Audit Logs
  """
  # Override Auth to be the Engineer
  app.dependency_overrides[get_current_user] = lambda: engineer_user

  # 1. Test Transition (DETECTED -> INVESTIGATING)
  transition_payload = {
    "new_state": "INVESTIGATING",
    "comment": "Starting investigation now.",
  }
  response = client.post(f"/api/v1/incidents/{incident_id}/transition", json=transition_payload)
  assert response.status_code == 200
  assert response.json()["status"] == "INVESTIGATING"

  # 2. Test Invalid Transition (INVESTIGATING -> DETECTED is not allowed)
  invalid_payload = {"new_state": "DETECTED"}
  response = client.post(f"/api/v1/incidents/{incident_id}/transition", json=invalid_payload)
  assert response.status_code == 400 # Bad Request

  # 3. Test Commenting
  comment_payload = {"comment": "Found the root cause: missing index."}
  response = client.post(f"/api/v1/incidents/{incident_id}/comment", json=comment_payload)
  assert response.status_code == 200

  # 4. Verify Audit Logs (The 'Events' endpoint)
  response = client.get(f"/api/v1/incidents/{incident_id}/events")
  assert response.status_code == 200
  events = response.json()
  
  # 5. Check for users list
  response = client.get("/api/v1/users")
  assert response.status_code == 200
  users = response.json()
  assert len(users) > 0
  
  # 6. Check the list of incidents to ensure our incident is present
  response = client.get("/api/v1/incidents")
  assert response.status_code == 200
  incidents = response.json()
  assert any(i["id"] == incident_id for i in incidents)
  
  # We expect 3 events: Creation (from fixture), Transition, Comment
  assert len(events) >= 2 
  
  # Check for the transition event
  transition_event = next(e for e in events if e["event_type"] == "STATUS_CHANGE")
  assert transition_event["old_value"] == "DETECTED"
  assert transition_event["new_value"] == "INVESTIGATING"
  
  # Check for the comment event
  comment_event = next(e for e in events if e["event_type"] == "COMMENT")
  assert comment_event["comment"] == "Found the root cause: missing index."

  # Cleanup override
  del app.dependency_overrides[get_current_user]


def test_rbac_assignment_restriction(client, db, engineer_user, test_organization):
  """
  Engineers cannot assign incidents to OTHERS.
  """
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  # Create another random user ID
  other_user = User(
    id=uuid.uuid4(),
    email="other@testing.com",
    full_name="Other Guy",
    role=UserRole.ENGINEER,
    organization_id=test_organization.id
  )
  
  db.add(other_user)
  db.commit()
  
  payload = {
    "title": "Restricted Incident",
    "description": "Trying to assign to someone else",
    "severity": "SEV3",
    "owner_id": str(other_user.id) # <--- This should be forbidden for Engineers
  }
  
  response = client.post("/api/v1/incidents", json=payload)
  
  assert response.status_code == 403
  assert "Not authorized" in response.json()["detail"]

  del app.dependency_overrides[get_current_user]


def test_incident_not_found(client, engineer_user):
  """Test 404 behavior"""
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  fake_id = str(uuid.uuid4())
  response = client.post(f"/api/v1/incidents/{fake_id}/transition", json={"new_state": "CLOSED"})
  
  assert response.status_code == 404
  
  del app.dependency_overrides[get_current_user]
  
def test_tenant_isolation(client, db, incident_id):
  """
  CRITICAL: A user from Org B should NOT be able to see Org A's incident.
  """
  # 1. Create a Competitor Org
  competitor_org = Organization(id=uuid.uuid4(), name="Competitor Corp", slug="comp-corp")
  db.add(competitor_org)
  
  # 2. Create a User in Competitor Org
  competitor_user = User(
    id=uuid.uuid4(),
    email="spy@competitor.com",
    full_name="Corporate Spy",
    role=UserRole.ADMIN, # Even an Admin shouldn't see other org's data
    organization_id=competitor_org.id
  )
  db.add(competitor_user)
  db.commit()

  # 3. Login as Competitor
  app.dependency_overrides[get_current_user] = lambda: competitor_user

  # 4. Try to access the original incident (belonging to Test Org)
  response = client.get(f"/api/v1/incidents/{incident_id}/events")
  
  # Should return 404 (Not Found) or 403 (Forbidden)
  # 404 is usually safer (don't reveal the ID exists)
  assert response.status_code in [403, 404] 
  
  # 5. Try to list incidents - should return empty list or only their own
  response = client.get("/api/v1/incidents")
  incidents = response.json()
  
  # Ensure the original incident ID is NOT in the list
  assert not any(i["id"] == incident_id for i in incidents)

  del app.dependency_overrides[get_current_user]