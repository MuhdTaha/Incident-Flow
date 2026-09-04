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
  sent = {}

  def fake_generate(email, redirect_to, user_metadata=None):
    captured["email"] = email
    captured["redirect_to"] = redirect_to
    captured["user_metadata"] = user_metadata
    return str(invited_id), "https://example.supabase.co/auth/v1/verify?token=abc&type=invite"

  def fake_send(to_email, org_name, invite_url):
    sent["to_email"] = to_email
    sent["org_name"] = org_name
    sent["invite_url"] = invite_url

  monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "sb_secret_testkey")
  monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
  monkeypatch.setattr("app.services.org_service.generate_invite_link", fake_generate)
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", fake_send)

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Jordan.Lee@Company.com", "role": "MANAGER"},
  )

  assert response.status_code == 200
  data = response.json()
  assert data["user_id"] == str(invited_id)
  assert data["invite_url"].endswith("type=invite")
  assert "jordan.lee@company.com" in data["message"].lower()
  assert captured["redirect_to"] == "http://localhost:3000/invite"
  assert captured["user_metadata"]["org_id"] == str(org.id)
  assert sent["to_email"] == "jordan.lee@company.com"
  assert sent["org_name"] == "Success Org"
  assert "type=invite" in sent["invite_url"]

  created = db.query(User).filter(User.id == invited_id).first()
  assert created is not None
  assert created.email == "jordan.lee@company.com"
  assert created.full_name == "Jordan Lee"
  assert created.role == UserRole.MANAGER
  assert created.invite_pending is True
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


def test_invite_reinvites_orphaned_auth_user(client, db, monkeypatch):
  org = _create_org(db, "Reinvite Org", "reinvite-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-reinvite@invite.com")
  leftover_auth_id = uuid.uuid4()
  fresh_auth_id = uuid.uuid4()
  invite_calls = []
  deleted = []
  sent = []

  def fake_generate(email, redirect_to, user_metadata=None):
    invite_calls.append(email)
    if len(invite_calls) == 1:
      raise EmailAlreadyRegistered(email)
    return str(fresh_auth_id), "https://example.supabase.co/auth/v1/verify?token=fresh&type=invite"

  monkeypatch.setenv("FRONTEND_URL", "https://app.example")
  monkeypatch.setattr("app.services.org_service.generate_invite_link", fake_generate)
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", lambda *args: sent.append(args))
  monkeypatch.setattr(
    "app.services.org_service.get_auth_user_id_by_email",
    lambda email: str(leftover_auth_id),
  )
  monkeypatch.setattr(
    "app.services.org_service.delete_auth_user",
    lambda user_id: deleted.append(user_id),
  )

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Existing.User@Company.com", "role": "ENGINEER"},
  )

  assert response.status_code == 200
  assert response.json()["user_id"] == str(fresh_auth_id)
  assert deleted == [str(leftover_auth_id)]
  assert len(invite_calls) == 2
  assert sent

  created = db.query(User).filter(User.id == fresh_auth_id).first()
  assert created is not None
  assert created.organization_id == org.id
  assert created.email == "existing.user@company.com"
  assert created.invite_pending is True
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_resends_pending_teammate(client, db, monkeypatch):
  org = _create_org(db, "Resend Org", "resend-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-resend@invite.com")
  pending_id = uuid.uuid4()
  pending = User(
    id=pending_id,
    email="alex@company.com",
    full_name="Alex",
    role=UserRole.ENGINEER,
    invite_pending=True,
    organization_id=org.id,
  )
  db.add(pending)
  db.commit()
  sent = []

  monkeypatch.setattr(
    "app.services.org_service.generate_invite_link",
    lambda email, redirect_to, user_metadata=None: (
      str(pending_id),
      "https://example.supabase.co/auth/v1/verify?token=resend&type=invite",
    ),
  )
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", lambda *args: sent.append(args))

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "Alex@Company.com", "role": "MANAGER"},
  )

  assert response.status_code == 200
  assert response.json()["user_id"] == str(pending_id)
  assert sent
  db.refresh(pending)
  assert pending.invite_pending is True
  assert pending.role == UserRole.MANAGER
  assert db.query(User).filter(User.email == "alex@company.com").count() == 1
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_reuses_existing_auth_id(client, db, monkeypatch):
  org = _create_org(db, "Reuse Id Org", "reuse-id-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-reuse@invite.com")
  leftover_id = uuid.uuid4()
  leftover = User(
    id=leftover_id,
    email="old-alias@company.com",
    full_name="Old Alias",
    role=UserRole.ENGINEER,
    invite_pending=True,
    organization_id=org.id,
  )
  db.add(leftover)
  db.commit()
  sent = []

  monkeypatch.setattr(
    "app.services.org_service.generate_invite_link",
    lambda email, redirect_to, user_metadata=None: (
      str(leftover_id),
      "https://example.supabase.co/auth/v1/verify?token=reuse&type=invite",
    ),
  )
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", lambda *args: sent.append(args))

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "vipikix112@mapsguy.com", "role": "ENGINEER"},
  )

  assert response.status_code == 200
  assert response.json()["user_id"] == str(leftover_id)
  assert sent
  db.refresh(leftover)
  assert leftover.email == "vipikix112@mapsguy.com"
  assert leftover.invite_pending is True
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_resends_unconfirmed_teammate(client, db, monkeypatch):
  org = _create_org(db, "Unconfirmed Org", "unconfirmed-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-unconfirmed@invite.com")
  leftover = _create_user(db, org.id, UserRole.ENGINEER, "quvovuby@fxzig.com")
  leftover.invite_pending = False
  db.commit()
  sent = []

  monkeypatch.setattr(
    "app.services.org_service.auth_confirmation_state",
    lambda user_id: "unconfirmed",
  )
  monkeypatch.setattr(
    "app.services.org_service.generate_invite_link",
    lambda email, redirect_to, user_metadata=None: (
      str(leftover.id),
      "https://example.supabase.co/auth/v1/verify?token=again&type=invite",
    ),
  )
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", lambda *args: sent.append(args))

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "quvovuby@fxzig.com", "role": "ENGINEER"},
  )

  assert response.status_code == 200
  assert sent
  db.refresh(leftover)
  assert leftover.invite_pending is True
  app.dependency_overrides.pop(get_current_user, None)


def test_invite_rejects_auth_id_linked_to_active_teammate(client, db, monkeypatch):
  org = _create_org(db, "Active Id Org", "active-id-org")
  admin = _create_user(db, org.id, UserRole.ADMIN, "admin-activeid@invite.com")
  active = _create_user(db, org.id, UserRole.ENGINEER, "already-joined@company.com")

  monkeypatch.setattr(
    "app.services.org_service.generate_invite_link",
    lambda email, redirect_to, user_metadata=None: (
      str(active.id),
      "https://example.supabase.co/auth/v1/verify?token=taken&type=invite",
    ),
  )
  monkeypatch.setattr("app.services.org_service.send_org_invite_email", lambda *args: None)

  app.dependency_overrides[get_current_user] = lambda: admin
  response = client.post(
    "/api/v1/orgs/invite",
    json={"email": "someone-else@company.com", "role": "ENGINEER"},
  )

  assert response.status_code == 409
  assert "already linked" in response.json()["detail"].lower()
  app.dependency_overrides.pop(get_current_user, None)
