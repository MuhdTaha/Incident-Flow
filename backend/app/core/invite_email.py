"""Send org invite emails via SMTP/Mailhog (local) or Mailjet (production)."""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from mailjet_rest import Client

DEFAULT_SENDER = "alerts@incidentflow.email"
LOCAL_SMTP_HOSTS = {"mailhog", "localhost", "127.0.0.1"}


def _html(org_name: str, invite_url: str) -> str:
  return f"""
  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
    <h2 style="color: #1d4ed8;">You're invited to {org_name}</h2>
    <p>An admin invited you to join this IncidentFlow workspace. Create your account to declare incidents, follow the timeline, and help the team respond.</p>
    <p>
      <a href="{invite_url}"
        style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
        Join workspace
      </a>
    </p>
    <p style="color: #64748b; font-size: 12px;">If the button does not work, paste this link into your browser:<br/>{invite_url}</p>
  </div>
  """


def _text(org_name: str, invite_url: str) -> str:
  return (
    f"You're invited to {org_name} on IncidentFlow.\n\n"
    "Open this link to create your account and join the workspace:\n"
    f"{invite_url}\n"
  )


def _is_local_smtp(host: str) -> bool:
  name = host.strip().lower().split(":")[0]
  return name in LOCAL_SMTP_HOSTS


def send_org_invite_email(to_email: str, org_name: str, invite_url: str) -> None:
  subject = f"Join {org_name} on IncidentFlow"
  html = _html(org_name, invite_url)
  text = _text(org_name, invite_url)
  smtp_host = (os.getenv("SMTP_HOST") or "").strip()
  smtp_port = int(os.getenv("SMTP_PORT") or "1025")
  mailjet_key = (os.getenv("MAILJET_API_KEY") or "").strip()
  mailjet_secret = (os.getenv("MAILJET_API_SECRET") or "").strip()
  sender = (os.getenv("MAILJET_SENDER_EMAIL") or DEFAULT_SENDER).strip() or DEFAULT_SENDER
  hosted = bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("FLY_APP_NAME"))

  # Local Docker sets SMTP_HOST=mailhog even when MAILJET_* is in .env.
  # On Render, a leftover SMTP_HOST=mailhog would swallow Mailjet and drop mail.
  if smtp_host and _is_local_smtp(smtp_host) and not hosted:
    _send_smtp(to_email, subject, html, text, smtp_host, smtp_port, sender)
    return
  if mailjet_key and mailjet_secret:
    _send_mailjet(to_email, subject, html, text, mailjet_key, mailjet_secret, sender)
    return
  if smtp_host:
    _send_smtp(to_email, subject, html, text, smtp_host, smtp_port, sender)
    return
  raise RuntimeError(
    "Invite email is not configured. Set MAILJET_API_KEY and MAILJET_API_SECRET, or SMTP_HOST for local Mailhog."
  )


def _send_mailjet(
  to_email: str,
  subject: str,
  html: str,
  text: str,
  api_key: str,
  api_secret: str,
  sender: str,
) -> None:
  mailjet = Client(auth=(api_key, api_secret), version="v3.1")
  result = mailjet.send.create(data={
    "Messages": [
      {
        "From": {"Email": sender, "Name": "IncidentFlow"},
        "To": [{"Email": to_email, "Name": to_email.split("@")[0]}],
        "Subject": subject,
        "TextPart": text,
        "HTMLPart": html,
        "CustomID": f"OrgInvite_{to_email}",
        # Tracking wrappers break Supabase invite tokens and trip spam filters.
        "TrackOpens": "disabled",
        "TrackClicks": "disabled",
      }
    ]
  })
  payload = result.json() if callable(getattr(result, "json", None)) else {}
  messages = payload.get("Messages") if isinstance(payload, dict) else None
  failed = [
    message
    for message in (messages or [])
    if str(message.get("Status") or "").lower() != "success"
  ]
  if result.status_code != 200 or failed or not messages:
    raise RuntimeError(f"Mailjet invite email failed ({result.status_code}): {payload}")


def _send_smtp(
  to_email: str,
  subject: str,
  html: str,
  text: str,
  host: str,
  port: int,
  sender: str,
) -> None:
  message = MIMEMultipart("alternative")
  message["From"] = sender
  message["To"] = to_email
  message["Subject"] = subject
  message.attach(MIMEText(text, "plain"))
  message.attach(MIMEText(html, "html"))
  with smtplib.SMTP(host, port, timeout=15) as smtp:
    smtp.sendmail(sender, [to_email], message.as_string())
