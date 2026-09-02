import uuid
from app.main import app
from app.api.deps import get_current_user
from app.core.supabase_admin import EmailAlreadyRegistered
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
  assert "already in your workspace" in response.json()["detail"].lower()
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_rejects_email_in_other_org(client, db):
  other = _create_org(db, "Other Co", "other-co")
  org = _create_org(db, "This Co", "this-co")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin@this.com")
  _create_user(db, other.id, UserRole.ENGINEER, "taken@company.com")
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "taken@company.com", "role": "ENGINEER"},
  )

  assert response.status_code == 409
  assert "another organization" in response.json()["detail"].lower()
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
  captured = {}

  def fake_invite(email, redirect_to, user_metadata=None):
    captured["email"] = email
    captured["redirect_to"] = redirect_to
    captured["user_metadata"] = user_metadata
    return str(invited_id)

  monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "sb_secret_testkey")
  monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
  monkeypatch.setattr("app.services.org_service.invite_user_by_email", fake_invite)

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Jordan.Lee@Company.com", "role": "MANAGER"},
  )

  assert response.status_code == 200
  data = response.json()
  assert data["user_id"] == str(invited_id)
  assert "jordan.lee@company.com" in data["message"].lower()
  assert captured["redirect_to"] == "http://localhost:3000/invite"
  assert captured["user_metadata"]["org_id"] == str(org.id)

  created = db.query(User).filter(User.id == invited_id).first()
  assert created is not None
  assert created.email == "jordan.lee@company.com"
  assert created.full_name == "Jordan Lee"
  assert created.role == UserRole.MANAGER
  assert created.organization_id == org.id
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_501_when_credentials_missing(client, db, monkeypatch):
  org = _create_org(db, "No Creds Org", "no-creds-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-nocreds@invite.com")
  monkeypatch.delenv("SUPABASE_URL", raising=False)
  monkeypatch.delenv("SUPABASE_KEY", raising=False)
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "new@invite.com", "role": "ENGINEER"},
  )

  assert response.status_code == 501
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_501_when_anon_key(client, db, monkeypatch):
  org = _create_org(db, "Anon Key Org", "anon-key-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-anon@invite.com")
  monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "sb_publishable_not_secret")
  app.dependency_overrides[get_current_user] = lambda: admin

  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "new@invite.com", "role": "ENGINEER"},
  )

  assert response.status_code == 501
  assert "publishable" in response.json()["detail"].lower()
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_attaches_existing_auth_user(client, db, monkeypatch):
  org = _create_org(db, "Attach Org", "attach-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-attach@invite.com")
  auth_id = uuid.uuid4()
  sent = {}

  def fake_invite(email, redirect_to, user_metadata=None):
    raise EmailAlreadyRegistered(email)

  def fake_lookup(email):
    return str(auth_id)

  def fake_link(email, redirect_to):
    sent["email"] = email
    sent["redirect_to"] = redirect_to

  monkeypatch.setenv("FRONTEND_URL", "https://app.example")
  monkeypatch.setattr("app.services.org_service.invite_user_by_email", fake_invite)
  monkeypatch.setattr("app.services.org_service.get_auth_user_id_by_email", fake_lookup)
  monkeypatch.setattr("app.services.org_service.send_login_link", fake_link)

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Existing.User@Company.com", "role": "ENGINEER"},
  )

  assert response.status_code == 200
  assert response.json()["user_id"] == str(auth_id)
  assert sent["email"] == "existing.user@company.com"
  assert sent["redirect_to"] == "https://app.example/invite"

  created = db.query(User).filter(User.id == auth_id).first()
  assert created is not None
  assert created.organization_id == org.id
  assert created.email == "existing.user@company.com"
  app.dependency_overrides.pop(get_current_user, None)
