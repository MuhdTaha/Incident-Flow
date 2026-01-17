# backend/tests/test_api.py
import pytest
import uuid
from main import app
from database import get_db
from deps import get_current_user
from models import User, UserRole
from fastapi import Depends

@pytest.fixture
def admin_user(db):
  """
  Creates an admin user attached to the CURRENT shared session.
  """
  user = User(
    id=uuid.uuid4(),
    email="admin@testing.com", 
    full_name="Admin User",
    role=UserRole.ADMIN
  )
  db.add(user)
  db.flush()
  db.refresh(user)
  return user

@pytest.fixture
def auth_override(admin_user):
  """
  Overrides the get_current_user dependency to return the admin_user.
  """
  app.dependency_overrides[get_current_user] = lambda: admin_user
  yield
  
  del app.dependency_overrides[get_current_user]

def test_create_incident(client, db, auth_override):
  payload = {
    "title": "Production Outage",
    "description": "The main service is down.",
    "severity": "SEV1"
  }
  response = client.post("/incidents", json=payload)
  
  if response.status_code != 200:
    print("DEBUG ERROR:", response.json())

  assert response.status_code == 200
  data = response.json()
  assert "id" in data
  assert data["message"] == "Incident created successfully"
  
def test_get_incidents(client, db, auth_override):
  # Seed data
  payload = {
    "title": "Production Outage",
    "description": "The main service is down.",
    "severity": "SEV1"
  }
  client.post("/incidents", json=payload)

  # Get Data
  response = client.get("/incidents")

  assert response.status_code == 200
  data = response.json()
  assert len(data) > 0
  assert any(i["title"] == "Production Outage" for i in data)