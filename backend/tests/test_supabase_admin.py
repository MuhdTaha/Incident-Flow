import uuid
from unittest.mock import Mock

import pytest

from app.core.supabase_admin import invite_user_by_email, supabase_admin_config


def test_invite_posts_to_gotrue(monkeypatch):
  invited_id = str(uuid.uuid4())
  captured = {}

  def fake_post(url, headers=None, json=None, timeout=None):
    captured["url"] = url
    captured["headers"] = headers
    captured["json"] = json
    response = Mock()
    response.status_code = 200
    response.content = b"{}"
    response.json.return_value = {"id": invited_id, "email": json["email"]}
    return response

  monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "sb_secret_testkey")
  monkeypatch.setattr("app.core.supabase_admin.httpx.post", fake_post)

  result = invite_user_by_email(
    "alex@company.com",
    redirect_to="https://app.example/invite",
    user_metadata={"org_id": "org-1"},
  )

  assert result == invited_id
  assert captured["url"] == "https://abc.supabase.co/auth/v1/invite"
  assert captured["json"]["redirect_to"] == "https://app.example/invite"
  assert captured["headers"]["apikey"] == "sb_secret_testkey"


def test_invite_reads_nested_user_id(monkeypatch):
  invited_id = str(uuid.uuid4())

  def fake_post(url, headers=None, json=None, timeout=None):
    response = Mock()
    response.status_code = 200
    response.content = b"{}"
    response.json.return_value = {"user": {"id": invited_id}}
    return response

  monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy")
  monkeypatch.setattr("app.core.supabase_admin.httpx.post", fake_post)

  assert invite_user_by_email("a@b.com", "http://localhost:3000/invite") == invited_id


def test_invite_http_error_surfaces_body(monkeypatch):
  def fake_post(url, headers=None, json=None, timeout=None):
    response = Mock()
    response.status_code = 401
    response.content = b"invalid"
    response.text = "Invalid API key"
    response.reason_phrase = "Unauthorized"
    return response

  monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
  monkeypatch.setenv("SUPABASE_KEY", "sb_secret_testkey")
  monkeypatch.setattr("app.core.supabase_admin.httpx.post", fake_post)

  with pytest.raises(RuntimeError, match="401"):
    invite_user_by_email("a@b.com", "http://localhost:3000/invite")


def test_config_message_is_generic():
  with pytest.raises(RuntimeError, match="SUPABASE_URL and SUPABASE_KEY are required"):
    supabase_admin_config("", "")
