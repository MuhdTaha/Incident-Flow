# backend/app/core/tasks.py

import os
import smtplib
from email.message import EmailMessage
import uuid
from datetime import datetime, timedelta

from app.core.celery_app import celery
from app.db.session import SessionLocal
import app.models as models

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))

SYSTEM_BOT_UUID = uuid.UUID(int=0)

@celery.task
def send_incident_alert_email(to_email: str, incident_title: str, incident_id: str, severity: str):
  """
  Sends an email notification via SMTP (MailHog in dev).
  """
  msg = EmailMessage()
  
  # Subject based on severity
  prefix = "[CRITICAL]" if severity == models.IncidentSeverity.SEV1 else "[Incident]"
  msg["Subject"] = f"{prefix} {incident_title} (#{str(incident_id)[:8]})"
  msg["From"] = "alerts@incidentflow.com"
  msg["To"] = to_email

  content = f"""
  Hello,

  A new incident has been reported.

  Title: {incident_title}
  Severity: {severity}
  ID: {incident_id}

  Please check the dashboard for more details.
  """
  msg.set_content(content)

  try:
    # Connect to MailHog (No password needed for dev)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
      server.send_message(msg)
      print(f"📧 Email sent to {to_email}")
      return "Email Sent"
  except Exception as e:
    print(f"❌ Failed to send email: {e}")
    # Retry logic could go here
    raise e
  
@celery.task
def check_sla_breaches():
  """
  Checks for incidents that are "DETECTED" and older than their SLA threshold.
  Auto-escalates their status to "ESCALATED" if breached.
  """
  
  db = SessionLocal()
  
  try:
    # 1. Define Threshold (60 mins for production)
    threshold_time = datetime.utcnow() - timedelta(minutes=60)
    
    # 2. Query Incidents that are DETECTED and older than threshold
    breached_incidents = db.query(models.Incident).filter(
      models.Incident.status == models.IncidentStatus.DETECTED,
      models.Incident.created_at < threshold_time
    ).all()
    
    if not breached_incidents:
      return "No SLA breaches"

    for incident in breached_incidents:
      print(f"⚠️ SLA Breach detected for Incident ID: {incident.id}")
      
      # 3. Update status to ESCALATED
      old_status = incident.status
      incident.status = models.IncidentStatus.ESCALATED
      
      # 4. Create Audit Log
      audit_log = models.IncidentEvent(
        incident_id=incident.id,
        actor_id=SYSTEM_BOT_UUID,  # System action
        event_type="SLA_BREACH",
        old_value=old_status,
        new_value=models.IncidentStatus.ESCALATED,
        comment="Auto-escalated due to inactivity > 60 mins"
      )
      
      db.add(audit_log)
      
      send_incident_alert_email.delay(
        to_email="mohd.taha75@gmail.com",
        incident_title=f"SLA BREACH: {incident.title}",
        incident_id=str(incident.id),
        severity=str(incident.severity)
      )
    
    db.commit()
    return f"Escalated {len(breached_incidents)} incidents"
  except Exception as e:
    db.rollback()
    print(f"❌ Error checking SLA breaches: {e}")
    raise e
  finally:
    db.close()