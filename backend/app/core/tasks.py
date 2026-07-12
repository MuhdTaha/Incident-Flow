# backend/app/core/tasks.py

import logging
import os
from datetime import datetime, timedelta, timezone

from mailjet_rest import Client

from app.core.celery_app import celery
from app.core.constants import SYSTEM_BOT_ID
from app.db.session import SessionLocal
import app.db.models as models

logger = logging.getLogger(__name__)

SLA_TRESHOLDS = {
  models.IncidentSeverity.SEV1: timedelta(minutes=60),
  models.IncidentSeverity.SEV2: timedelta(minutes=120),
  models.IncidentSeverity.SEV3: timedelta(hours=4),
  models.IncidentSeverity.SEV4: timedelta(hours=24),
}

MAILJET_API_KEY = os.getenv("MAILJET_API_KEY")
MAILJET_API_SECRET = os.getenv("MAILJET_API_SECRET")
MAILJET_SENDER_EMAIL = os.getenv("MAILJET_SENDER_EMAIL", "alerts@incidentflow.email")

mailjet = Client(auth=(MAILJET_API_KEY, MAILJET_API_SECRET), version='v3.1')

@celery.task
def send_incident_alert_email(to_email: str, incident_title: str, incident_id: str, severity: str):
  """
  Sends an email notification via Mailjet.
  """
  
  subject = f"[{severity}] {incident_title} (#{str(incident_id)[:8]})"
  
  html_content = f"""
  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
    <h2 style="color: {'#e53e3e' if severity == 'SEV1' else '#2b6cb0'};">New Incident Triggered</h2>
    <p><strong>Title:</strong> {incident_title}</p>
    <p><strong>Severity:</strong> {severity}</p>
    <p><strong>ID:</strong> {incident_id}</p>
    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;"/>
    <a href="https://app.incidentflow.com/incidents/{incident_id}" 
      style="padding: 10px 20px; background: #2b6cb0; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
      View Incident Dashboard
    </a>
  </div>
  """
  
  data = {
    'Messages': [
      {
        "From": {
          "Email": MAILJET_SENDER_EMAIL,
          "Name": "IncidentFlow Alerts"
        },
        "To": [
          {
            "Email": to_email,
            "Name": "IncidentFlow User"
          }
        ],
        "Subject": subject,
        "HTMLPart": html_content,
        "CustomID": f"IncidentAlert_{incident_id}" # Helpful for Mailjet analytics
      }
    ]
  }

  try:
    # Execute the API call to send the email
    result = mailjet.send.create(data=data)
    
    # Mailjet returns 200 on success
    if result.status_code == 200:
      print(f"✅ Email sent successfully for Incident ID: {incident_id}")
      return "Email sent"
    else:
      print(f"❌ Failed to send email for Incident ID: {incident_id}. Status Code: {result.status_code}, Response: {result.json()}")
      raise Exception(f"Mailjet API error: {result.status_code}")
  except Exception as e:
    print(f"❌ Exception while sending email for Incident ID: {incident_id}. Error: {e}")
    raise self.retry(exc=e, countdown=60)  # Retry after 60 seconds
  
@celery.task(bind=True)
def check_sla_breaches(self):
  """
  Checks for incidents that are "DETECTED" and older than their SLA threshold.
  Auto-escalates their status to "ESCALATED" if breached.
  """
  
  db = SessionLocal()
  now = datetime.now(timezone.utc)
  escalated_count = 0
  
  try:
    # 1. Fetch all incidents that are in "DETECTED" status
    active_incidents = db.query(models.Incident).filter(models.Incident.status == models.IncidentStatus.DETECTED).all()
    
    for incident in active_incidents:
      sla_treshold = SLA_TRESHOLDS.get(incident.severity)
      if sla_treshold and (now - incident.created_at.replace(tzinfo=timezone.utc)) > sla_treshold:
        
        print(f"⚠️ SLA Breach detected for Incident ID: {incident.id}")
        
        # Update the incident status to ESCALATED
        old_status = incident.status
        incident.status = models.IncidentStatus.ESCALATED
        
        # Create an audit log for this change
        audit_log = models.IncidentEvent(
          incident_id=incident.id,
          actor_id=SYSTEM_BOT_ID,
          organization_id=incident.organization_id,
          event_type="SLA_BREACH",
          old_value=old_status,
          new_value=models.IncidentStatus.ESCALATED,
          comment=f"Auto-escalated: {incident.severity} incident breached SLA of {sla_treshold}."
        )

        db.add(audit_log)

        recipients = []
        if incident.owner_id:
          owner_email = db.query(models.User.email).filter(models.User.id == incident.owner_id).scalar()
          if owner_email:
            recipients.append(owner_email)
        admin_emails = [
          email for (email,) in db.query(models.User.email).filter(
            models.User.organization_id == incident.organization_id,
            models.User.role == models.UserRole.ADMIN,
          ).all()
        ]
        recipients.extend(admin_emails)

        for email in set(recipients):
          send_incident_alert_email.delay(
            to_email=email,
            incident_title=f"SLA BREACH: {incident.title}",
            incident_id=str(incident.id),
            severity=str(incident.severity)
          )

        escalated_count += 1

    db.commit()
    return f"Escalated {escalated_count} incidents due to SLA breaches."
  except Exception as e:
    logger.exception("SLA breach check failed: %s", e)
    raise
  finally:
    db.close()


@celery.task(name="app.core.tasks.refresh_demo_data")
def refresh_demo_data(actions: int = 3):
  """
  Keep the demo org looking alive: ensure catalog exists, then append
  fresh comments / status transitions. Scheduled by Celery Beat.
  """
  # Lazy import so worker boot stays light if seed module changes
  from app.services.demo_seed_service import run_refresh

  result = run_refresh(actions=actions)
  logger.info("Demo refresh complete: %s", result)
  return result