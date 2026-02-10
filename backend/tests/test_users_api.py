import uuid
import pytest
from app.main import app
from app.api.deps import get_current_user
from app.db.models import User, UserRole, Organization


@pytest.fixture
def test_organization(db):
  org = Organization(
    id=uuid.uuid4(),
    name="User Test Org",
    slug="user-test-org",
  )
  db.add(org)
  db.commit()
  db.refresh(org)
  return org


@pytest.fixture
def other_organization(db):
  org = Organization(
    id=uuid.uuid4(),
    name="Other Org",
    slug="other-org",
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
  return _create_user(db, test_organization.id, UserRole.ADMIN, "admin@users.com")


@pytest.fixture
def engineer_user(db, test_organization):
  return _create_user(db, test_organization.id, UserRole.ENGINEER, "eng@users.com")


@pytest.fixture
def auth_override():
  yield
  app.dependency_overrides.pop(get_current_user, None)
  
  
def test_user_organization(client, db, admin_user, test_organization, other_organization):  
  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/users/organization")
  assert response.status_code == 200
  data = response.json()
  assert data["id"] == str(test_organization.id)
  

def test_list_users_scoped(client, db, auth_override, admin_user, test_organization, other_organization):
  _create_user(db, test_organization.id, UserRole.MANAGER, "mgr@users.com")
  _create_user(db, other_organization.id, UserRole.ADMIN, "admin@other.com")

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/users")

  assert response.status_code == 200
  data = response.json()
  assert len(data) == 2
  assert all(u["organization_id"] == str(test_organization.id) for u in data)


def test_update_role_admin_success(client, db, auth_override, admin_user, test_organization):
  target_user = _create_user(db, test_organization.id, UserRole.ENGINEER, "target@users.com")

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.patch(
    f"/api/v1/users/{target_user.id}/role",
    json={"role": "MANAGER"}
  )

  assert response.status_code == 200
  db.refresh(target_user)
  assert target_user.role == UserRole.MANAGER


def test_update_role_self_blocked(client, auth_override, admin_user):
  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.patch(
    f"/api/v1/users/{admin_user.id}/role",
    json={"role": "MANAGER"}
  )

  assert response.status_code == 400
  assert "cannot change" in response.json()["detail"].lower()


def test_delete_user_admin_only(client, db, auth_override, admin_user, engineer_user, test_organization):
  target_user = _create_user(db, test_organization.id, UserRole.ENGINEER, "delete@users.com")

  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.delete(f"/api/v1/users/{target_user.id}")
  assert response.status_code == 403

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.delete(f"/api/v1/users/{target_user.id}")
  assert response.status_code == 200

  assert db.query(User).filter(User.id == target_user.id).first() is None
