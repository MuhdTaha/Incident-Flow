import uuid
import pytest
from app.main import app
from app.db.models import User, UserRole, Organization
from app.api.deps import get_current_user_id_from_token

@pytest.fixture
def existing_user(db):
  org = Organization(id=uuid.uuid4(), name="Existing Org", slug="existing-org")
  db.add(org)
  user = User(
    id=uuid.uuid4(),
    email="existing@example.com",
    full_name="Existing User",
    role=UserRole.ENGINEER,
    organization_id=org.id,
  )
  db.add(user)
  db.commit()
  return user

def test_register_rejects_existing_user(client, existing_user):
  app.dependency_overrides[get_current_user_id_from_token] = lambda: {
    "id": str(existing_user.id),
    "email": existing_user.email,
  }

  response = client.post("/api/v1/orgs/register", json={"name": "New Org"})
  assert response.status_code == 400
  assert "already exists" in response.json()["detail"].lower()

  del app.dependency_overrides[get_current_user_id_from_token]
