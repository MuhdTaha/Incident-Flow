from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from typing import List, Optional
from app.models import Incident, IncidentEvent, IncidentAttachment

class IncidentRepository:
  def __init__(self, db: Session):
    self.db = db

  def get_by_id(self, incident_id: UUID, org_id: UUID) -> Optional[Incident]:
    return self.db.query(Incident).filter(
      Incident.id == incident_id,
      Incident.organization_id == org_id
    ).first()

  def get_all(self, org_id: UUID) -> List[Incident]:
    return self.db.query(Incident).filter(
      Incident.organization_id == org_id
    ).all()

  def create(self, incident: Incident) -> Incident:
    self.db.add(incident)
    self.db.commit()
    self.db.refresh(incident)
    return incident

  def update(self, incident: Incident) -> Incident:
    self.db.add(incident)
    self.db.commit()
    self.db.refresh(incident)
    return incident
  
  def delete(self, incident: Incident):
    self.db.delete(incident)
    self.db.commit()
    
  # --- Events (Audit Log) ---

  def add_event(self, event: IncidentEvent):
    self.db.add(event)
    self.db.commit()
  
  def get_events(self, incident_id: UUID) -> List[IncidentEvent]:
    return self.db.query(IncidentEvent).filter(
      IncidentEvent.incident_id == incident_id
    ).order_by(IncidentEvent.created_at.desc()).all()
  
  # --- Attachments ---
  def add_attachment(self, attachment: IncidentAttachment):
    self.db.add(attachment)
    self.db.commit()
    self.db.refresh(attachment)
    return attachment

  def get_attachment(self, attachment_id: UUID, incident_id: UUID, org_id: UUID):
    return self.db.query(IncidentAttachment).filter(
      IncidentAttachment.id == attachment_id,
      IncidentAttachment.incident_id == incident_id,
      IncidentAttachment.organization_id == org_id
    ).first()

  def get_attachments_for_incident(self, incident_id: UUID) -> List[IncidentAttachment]:
    return self.db.query(IncidentAttachment)\
      .filter(IncidentAttachment.incident_id == incident_id)\
      .all()
  
  def delete_attachment(self, attachment: IncidentAttachment):
    self.db.delete(attachment)
    self.db.commit()