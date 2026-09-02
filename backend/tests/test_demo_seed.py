import uuid
import pytest
from app.db.models import Organization, User, UserRole
from app.services.demo_seed_service import (
  DEMO_USER_SPECS,
  DemoSeedService,
)
from app.core.supabase_admin import supabase_admin_config


def test_admin_config_rejects_publishable_key():
  with pytest.raises(RuntimeError, match="publishable/anon"):
    supabase_admin_config("https://abc.supabase.co", "sb_publishable_test")


def test_admin_config_accepts_secret_and_strips_quotes():
  url, headers = supabase_admin_config(
    '  "https://abc.supabase.co/"  ',
    '  "sb_secret_testkey"  ',
  )
  assert url == "https://abc.supabase.co"
  assert headers["apikey"] == "sb_secret_testkey"
  assert headers["Authorization"] == "Bearer sb_secret_testkey"


def test_admin_config_requires_both():
  with pytest.raises(RuntimeError, match="SUPABASE_URL and SUPABASE_KEY"):
    supabase_admin_config("", "sb_secret_x")


@pytest.fixture
def demo_org(db, client):
  org = Organization(
    id=uuid.uuid4(),
    name="Demo Seed Org",
    slug="demo-seed-org",
  )
  db.add(org)
  db.flush()
  db.refresh(org)
  return org


def test_align_local_user_inserts_with_auth_id(db, demo_org):
  svc = DemoSeedService(db, org_id=demo_org.id)
  svc._ensure_org()
  spec = DEMO_USER_SPECS[2]  # Jordan / ENGINEER
  auth_id = uuid.uuid4()

  svc._align_local_user(spec, auth_id)

  user = db.query(User).filter(User.email == spec["email"]).one()
  assert user.id == auth_id
  assert user.role == UserRole.ENGINEER
  assert user.organization_id == demo_org.id


def test_align_local_user_repoints_existing_email(db, demo_org):
  svc = DemoSeedService(db, org_id=demo_org.id)
  svc._ensure_org()
  spec = DEMO_USER_SPECS[1]  # Sarah / MANAGER
  old = User(
    id=uuid.uuid4(),
    email=spec["email"],
    full_name="Old Name",
    role=UserRole.ENGINEER,
    organization_id=demo_org.id,
  )
  db.add(old)
  db.flush()
  auth_id = uuid.uuid4()

  svc._align_local_user(spec, auth_id)

  assert db.query(User).filter(User.id == old.id).first() is None
  user = db.query(User).filter(User.email == spec["email"]).one()
  assert user.id == auth_id
  assert user.role == UserRole.MANAGER
  assert user.full_name == spec["full_name"]
