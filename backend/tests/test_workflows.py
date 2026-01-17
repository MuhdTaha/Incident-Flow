# backend/tests/test_workflows.py
import pytest
import uuid
from main import app
from database import get_db
from models import User, UserRole, IncidentStatus, Incident
from deps import get_current_user

# --- Fixtures ---

@pytest.fixture
def engineer_user(db):
  """Creates a standard ENGINEER user."""
  user = User(
    id=uuid.uuid4(),
    email="eng@testing.com", 
    full_name="Software Engineer",
    role=UserRole.ENGINEER
  )
  db.add(user)
  db.flush()
  db.refresh(user)
  return user

@pytest.fixture
def incident_id(db, engineer_user):
  """Seeds a single incident to test against."""
  inc = Incident(
    title="Database Latency",
    description="High latency on primary DB",
    severity="SEV2",
    owner_id=engineer_user.id,
    status=IncidentStatus.DETECTED
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
    "comment": "Starting investigation now."
  }
  response = client.post(f"/incidents/{incident_id}/transition", json=transition_payload)
  assert response.status_code == 200
  assert response.json()["status"] == "INVESTIGATING"

  # 2. Test Invalid Transition (INVESTIGATING -> DETECTED is not allowed)
  invalid_payload = {"new_state": "DETECTED"}
  response = client.post(f"/incidents/{incident_id}/transition", json=invalid_payload)
  assert response.status_code == 400 # Bad Request

  # 3. Test Commenting
  comment_payload = {"comment": "Found the root cause: missing index."}
  response = client.post(f"/incidents/{incident_id}/comment", json=comment_payload)
  assert response.status_code == 200

  # 4. Verify Audit Logs (The 'Events' endpoint)
  response = client.get(f"/incidents/{incident_id}/events")
  assert response.status_code == 200
  events = response.json()
  
  # 5. Check for users list
  response = client.get("/users")
  assert response.status_code == 200
  users = response.json()
  assert len(users) > 0
  
  # 6. Check the list of incidents to ensure our incident is present
  response = client.get("/incidents")
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


def test_rbac_assignment_restriction(client, db, engineer_user):
  """
  Engineers cannot assign incidents to OTHERS.
  """
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  # Create another random user ID
  other_user_id = str(uuid.uuid4())
  
  payload = {
    "title": "Restricted Incident",
    "description": "Trying to assign to someone else",
    "severity": "SEV3",
    "owner_id": other_user_id # <--- This should be forbidden for Engineers
  }
  
  response = client.post("/incidents", json=payload)
  
  assert response.status_code == 403
  assert "Not authorized" in response.json()["detail"]

  del app.dependency_overrides[get_current_user]


def test_incident_not_found(client, engineer_user):
  """Test 404 behavior"""
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  
  fake_id = str(uuid.uuid4())
  response = client.post(f"/incidents/{fake_id}/transition", json={"new_state": "CLOSED"})
  
  assert response.status_code == 404
  
  del app.dependency_overrides[get_current_user]