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


@pytest.fixture
def default_org(db, monkeypatch):
  org_id = uuid.uuid4()
  monkeypatch.setattr("app.services.org_service.DEFAULT_ORG_ID", org_id)
  org = Organization(id=org_id, name="Default Org", slug="default-org")
  db.add(org)
  db.commit()
  return org


def test_register_rejects_existing_user(client, existing_user):
  app.dependency_overrides[get_current_user_id_from_token] = lambda: {
    "id": str(existing_user.id),
    "email": existing_user.email,
  }

  response = client.post("/api/v1/orgs/register", json={"name": "New Org"})
  assert response.status_code == 400
  assert "already exists" in response.json()["detail"].lower()

  del app.dependency_overrides[get_current_user_id_from_token]


def test_register_creates_org_for_new_user(client, db):
  user_id = uuid.uuid4()
  app.dependency_overrides[get_current_user_id_from_token] = lambda: {
    "id": str(user_id),
    "email": "founder@example.com",
  }

  response = client.post("/api/v1/orgs/register", json={"name": "Acme"})
  assert response.status_code == 200
  data = response.json()
  assert data["organization"]["name"] == "Acme"
  assert data["user"]["email"] == "founder@example.com"
  assert data["user"]["role"] == "ADMIN"

  created = db.query(User).filter(User.id == user_id).one()
  assert created.role == UserRole.ADMIN
  assert created.organization_id == uuid.UUID(data["organization"]["id"])

  del app.dependency_overrides[get_current_user_id_from_token]


def test_register_claims_default_org_engineer(client, db, default_org):
  user = User(
    id=uuid.uuid4(),
    email="founder@example.com",
    full_name="Founder",
    role=UserRole.ENGINEER,
    organization_id=default_org.id,
  )
  db.add(user)
  db.commit()

  app.dependency_overrides[get_current_user_id_from_token] = lambda: {
    "id": str(user.id),
    "email": user.email,
  }

  response = client.post("/api/v1/orgs/register", json={"name": "Acme"})
  assert response.status_code == 200

  db.refresh(user)
  assert user.role == UserRole.ADMIN
  assert user.organization_id != default_org.id
  assert user.organization_id == uuid.UUID(response.json()["organization"]["id"])

  del app.dependency_overrides[get_current_user_id_from_token]


def test_register_rejects_demo_persona(client, db, default_org):
  user = User(
    id=uuid.uuid4(),
    email="jordan.dev@company.com",
    full_name="Jordan Smyth",
    role=UserRole.ENGINEER,
    organization_id=default_org.id,
  )
  db.add(user)
  db.commit()

  app.dependency_overrides[get_current_user_id_from_token] = lambda: {
    "id": str(user.id),
    "email": user.email,
  }

  response = client.post("/api/v1/orgs/register", json={"name": "Acme"})
  assert response.status_code == 400
  assert "already exists" in response.json()["detail"].lower()

  db.refresh(user)
  assert user.organization_id == default_org.id
  assert user.role == UserRole.ENGINEER

  del app.dependency_overrides[get_current_user_id_from_token]
