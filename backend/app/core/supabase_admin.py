"""
Supabase Auth Admin helpers.

supabase-py 2.6 only accepts legacy JWT keys (eyJ...). Newer projects issue
sb_secret_ keys, so we call GoTrue over HTTP instead of create_client().
"""

from __future__ import annotations

import os
from typing import Optional, Tuple

import httpx


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

  if response.status_code >= 400:
    detail = response.text.strip()[:400]
    raise RuntimeError(
      f"Supabase invite failed ({response.status_code}): {detail or response.reason_phrase}"
    )

  data = response.json() if response.content else {}
  user = data.get("user") if isinstance(data.get("user"), dict) else data
  user_id = (user or {}).get("id")
  if not user_id:
    raise RuntimeError("Supabase invite did not return a user id")
  return str(user_id)
