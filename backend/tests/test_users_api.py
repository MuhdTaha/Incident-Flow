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
  response = client.get("/api/v1/orgs/org_profile")
  assert response.status_code == 200
  data = response.json()
  assert data["id"] == str(test_organization.id)
  

def test_get_me_unauthorized(client):
  app.dependency_overrides.pop(get_current_user, None)
  response = client.get("/api/v1/users/me")
  assert response.status_code == 401


def test_get_me_returns_backend_role(client, auth_override, admin_user, test_organization):
  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/users/me")

  assert response.status_code == 200
  data = response.json()
  assert data == {
    "id": str(admin_user.id),
    "role": "ADMIN",
    "org_id": str(test_organization.id),
    "full_name": admin_user.full_name,
    "invite_pending": False,
  }


def test_get_me_engineer_role(client, auth_override, engineer_user, test_organization):
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.get("/api/v1/users/me")

  assert response.status_code == 200
  data = response.json()
  assert data["role"] == "ENGINEER"
  assert data["id"] == str(engineer_user.id)
  assert data["org_id"] == str(test_organization.id)


def test_list_users_scoped(client, db, auth_override, admin_user, test_organization, other_organization):
  _create_user(db, test_organization.id, UserRole.MANAGER, "mgr@users.com")
  _create_user(db, other_organization.id, UserRole.ADMIN, "admin@other.com")

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/users")

  assert response.status_code == 200
  data = response.json()
  assert len(data) == 2
  assert all(u["organization_id"] == str(test_organization.id) for u in data)


def test_list_users_hides_pending_invitees(client, db, auth_override, admin_user, test_organization):
  pending = _create_user(db, test_organization.id, UserRole.ENGINEER, "pending@users.com")
  pending.invite_pending = True
  db.commit()

  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.get("/api/v1/users")

  assert response.status_code == 200
  emails = {u["email"] for u in response.json()}
  assert pending.email not in emails
  assert admin_user.email in emails


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


def test_delete_user_removes_auth_login(
  client, db, auth_override, admin_user, test_organization, monkeypatch
):
  target_user = _create_user(db, test_organization.id, UserRole.ENGINEER, "auth-del@users.com")
  deleted = []
  monkeypatch.setattr(
    "app.services.user_service.delete_auth_user",
    lambda user_id: deleted.append(user_id),
  )
  app.dependency_overrides[get_current_user] = lambda: admin_user
  response = client.delete(f"/api/v1/users/{target_user.id}")

  assert response.status_code == 200
  assert deleted == [str(target_user.id)]
  assert db.query(User).filter(User.id == target_user.id).first() is None


def test_patch_me_updates_full_name(client, auth_override, engineer_user, db):
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.patch("/api/v1/users/me", json={"full_name": "Ada Lovelace"})

  assert response.status_code == 200
  data = response.json()
  assert data["full_name"] == "Ada Lovelace"
  assert data["role"] == "ENGINEER"
  db.refresh(engineer_user)
  assert engineer_user.full_name == "Ada Lovelace"


def test_patch_me_clears_invite_pending(client, auth_override, engineer_user, db):
  engineer_user.invite_pending = True
  db.flush()
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.patch("/api/v1/users/me", json={"full_name": "Ada Lovelace"})

  assert response.status_code == 200
  db.refresh(engineer_user)
  assert engineer_user.invite_pending is False


def test_patch_me_ignores_role_escalation(client, auth_override, engineer_user, db):
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.patch(
    "/api/v1/users/me",
    json={"full_name": "Ada", "role": "ADMIN"},
  )

  assert response.status_code == 200
  db.refresh(engineer_user)
  assert engineer_user.role == UserRole.ENGINEER


def test_patch_me_rejects_blank_name(client, auth_override, engineer_user):
  app.dependency_overrides[get_current_user] = lambda: engineer_user
  response = client.patch("/api/v1/users/me", json={"full_name": "   "})

  assert response.status_code == 400

