from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from app.db.models import IncidentAttachment

class AttachmentRepository:
  def __init__(self, db: Session):
    self.db = db

  def add(self, attachment: IncidentAttachment) -> IncidentAttachment:
    self.db.add(attachment)
    self.db.flush()
    self.db.refresh(attachment)
    return attachment

  def get_by_id(self, attachment_id: UUID, incident_id: UUID, org_id: UUID) -> Optional[IncidentAttachment]:
    return self.db.query(IncidentAttachment).filter(
      IncidentAttachment.id == attachment_id,
      IncidentAttachment.incident_id == incident_id,
      IncidentAttachment.organization_id == org_id
    ).first()

  def list_by_incident(self, incident_id: UUID, org_id: UUID) -> List[IncidentAttachment]:
    return self.db.query(IncidentAttachment).filter(
      IncidentAttachment.incident_id == incident_id,
      IncidentAttachment.organization_id == org_id
    ).all()

  def delete_entity(self, attachment: IncidentAttachment):
    self.db.delete(attachment)
