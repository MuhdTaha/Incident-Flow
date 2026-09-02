import uuid
from types import SimpleNamespace

from app.main import app
from app.api.deps import get_current_user
from app.db.models import User, UserRole, Organization


def _create_org(db, name="Invite Test Org", slug="invite-test-org"):
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


def test_invite_forbidden_for_non_admin(client, db):
  org = _create_org(db)
  engineer = _create_user(db, org.id, UserRole.ENGINEER, "eng@invite.com")
  app.dependency_overrides[get_current_user] = lambda: engineer

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "new@invite.com", "role": "ENGINEER"},
  )

  assert response.status_code == 403
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_rejects_duplicate_email(client, db):
  org = _create_org(db, "Dup Org", "dup-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin@invite.com")
  _create_user(db, org.id, UserRole.ENGINEER, "taken@invite.com")
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "taken@invite.com", "role": "ENGINEER"},
  )

  assert response.status_code == 409
  assert "already exists" in response.json()["detail"].lower()
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_rejects_bot_role(client, db):
  org = _create_org(db, "Bot Org", "bot-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-bot@invite.com")
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "bot@invite.com", "role": "BOT"},
  )

  assert response.status_code == 400
  assert "role" in response.json()["detail"].lower()
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_success_creates_local_user(client, db, monkeypatch):
  org = _create_org(db, "Success Org", "success-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-success@invite.com")
  invited_id = uuid.uuid4()

  class FakeAdmin:
    def invite_user_by_email(self, email, options=None):
      self.email = email
      self.options = options
      return SimpleNamespace(user=SimpleNamespace(id=str(invited_id)))

  fake_admin = FakeAdmin()

  class FakeClient:
    def __init__(self):
      self.auth = SimpleNamespace(admin=fake_admin)

  monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
  monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
  monkeypatch.setattr("app.services.org_service.create_client", lambda url, key: FakeClient())

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Jordan.Lee@Company.com", "role": "MANAGER"},
  )

  assert response.status_code == 200
  data = response.json()
  assert data["user_id"] == str(invited_id)
  assert "jordan.lee@company.com" in data["message"].lower()
  assert fake_admin.options["redirect_to"] == "http://localhost:3000/invite"
  assert fake_admin.options["data"]["org_id"] == str(org.id)

  created = db.query(User).filter(User.id == invited_id).first()
  assert created is not None
  assert created.email == "jordan.lee@company.com"
  assert created.full_name == "Jordan Lee"
  assert created.role == UserRole.MANAGER
  assert created.organization_id == org.id
  app.dependency_overrides.pop(get_current_user, None)
