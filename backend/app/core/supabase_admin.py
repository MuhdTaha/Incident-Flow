"""
Supabase Auth Admin helpers.

supabase-py 2.6 only accepts legacy JWT keys (eyJ...). Newer projects issue
sb_secret_ keys, so we call GoTrue over HTTP instead of create_client().
"""

from __future__ import annotations

import os
from typing import Optional, Tuple

import httpx


class EmailAlreadyRegistered(RuntimeError):
  """GoTrue /invite returned 422 email_exists."""


def _strip_env(value: Optional[str]) -> str:
  return (value or "").strip().strip('"').strip("'")


def supabase_admin_config(url: Optional[str], key: Optional[str]) -> Tuple[str, dict]:
  base = _strip_env(url).rstrip("/")
  secret = _strip_env(key)
  if not base or not secret:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required")
  if secret.startswith("sb_publishable_") or secret.startswith("sb_anon_"):
    raise RuntimeError(
      "SUPABASE_KEY is the publishable/anon key. Use the secret key "
      "(Dashboard → Settings → API → secret / service_role)."
    )
  if secret.startswith("your-") or secret == "your-service-role-key":
    raise RuntimeError("SUPABASE_KEY is still the placeholder from .env.example")
  headers = {
    "apikey": secret,
    "Authorization": f"Bearer {secret}",
    "Content-Type": "application/json",
  }
  return base, headers


def _raise_for_status(response: httpx.Response, action: str) -> None:
  if response.status_code < 400:
    return
  detail = (response.text or "").strip()[:400]
  raise RuntimeError(
    f"Supabase {action} failed ({response.status_code}): {detail or response.reason_phrase}"
  )


def _json_body(response: httpx.Response) -> dict:
  if not response.content:
    return {}
  try:
    data = response.json()
  except Exception:
    return {}
  return data if isinstance(data, dict) else {}


def invite_user_by_email(email: str, redirect_to: str, user_metadata: Optional[dict] = None) -> str:
  """
  Send a Supabase invite email via GoTrue POST /auth/v1/invite.
  Returns the new Auth user id.
  """
  base, headers = supabase_admin_config(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
  payload = {
    "email": email,
    "data": user_metadata or {},
    "redirect_to": redirect_to,
  }
  try:
    response = httpx.post(
      f"{base}/auth/v1/invite",
      headers=headers,
      json=payload,
      timeout=30,
    )
  except httpx.HTTPError as exc:
    raise RuntimeError(f"Supabase invite request failed: {exc}") from exc

  if response.status_code == 422:
    body = _json_body(response)
    code = str(body.get("error_code") or body.get("code") or "").lower()
    text = (response.text or "").lower()
    if code == "email_exists" or "email_exists" in text or "already been registered" in text:
      raise EmailAlreadyRegistered(email)

  _raise_for_status(response, "invite")

  data = _json_body(response)
  user = data.get("user") if isinstance(data.get("user"), dict) else data
  user_id = (user or {}).get("id")
  if not user_id:
    raise RuntimeError("Supabase invite did not return a user id")
  return str(user_id)


def get_auth_user_id_by_email(email: str) -> Optional[str]:
  base, headers = supabase_admin_config(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
  target = email.strip().lower()
  for page in range(1, 11):
    try:
      response = httpx.get(
        f"{base}/auth/v1/admin/users",
        headers=headers,
        params={"page": page, "per_page": 200, "email": target},
        timeout=30,
      )
    except httpx.HTTPError as exc:
      raise RuntimeError(f"Supabase user lookup failed: {exc}") from exc
    _raise_for_status(response, "user lookup")
    data = _json_body(response)
    users = data.get("users") if isinstance(data.get("users"), list) else []
    if data.get("id") and not users:
      users = [data]
    for user in users:
      if (user.get("email") or "").lower() == target:
        return str(user["id"])
    if len(users) < 200:
      break
  return None


def send_login_link(email: str, redirect_to: str) -> None:
  """Email a magic link so an existing Auth user can open /invite."""
  base, headers = supabase_admin_config(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
  payload = {
    "type": "magiclink",
    "email": email,
    "options": {"redirect_to": redirect_to},
  }
  try:
    response = httpx.post(
      f"{base}/auth/v1/admin/generate_link",
      headers=headers,
      json=payload,
      timeout=30,
    )
  except httpx.HTTPError as exc:
    raise RuntimeError(f"Supabase login link request failed: {exc}") from exc
  _raise_for_status(response, "login link")
