# backend/app/services/incident_service.py

from uuid import UUID
from datetime import datetime
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import models
from app.schemas import incident as schemas
from app.repositories.incident_repo import IncidentRepository
from app.core.tasks import send_incident_alert_email
from app.core.fsm import can_transition, IncidentStatus

class IncidentService:
  def __init__(self, db: Session):
    self.repo = IncidentRepository(db)
    self.db = db

  def _commit(self):
    self.db.commit()

  def list_incidents(self, org_id: UUID) -> List[models.Incident]:
    return self.repo.get_all(org_id)

  def create_incident(self, data: schemas.IncidentCreate, user: models.User, org_id: UUID) -> models.Incident:
    final_owner_id = user.id
    if data.owner_id and data.owner_id != user.id:
      if user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to assign incidents to others")
      final_owner_id = data.owner_id

    new_incident = models.Incident(
      title=data.title,
      description=data.description,
      severity=data.severity,
      owner_id=final_owner_id,
      status=IncidentStatus.DETECTED,
      organization_id=org_id
    )

    created = self.repo.add(new_incident)

    audit = models.IncidentEvent(
      incident_id=created.id,
      actor_id=user.id,
      organization_id=org_id,
      event_type="CREATION",
      new_value=IncidentStatus.DETECTED,
      comment=f"Incident declared by {user.full_name}"
      + (f" (Assigned to {final_owner_id})" if final_owner_id != user.id else "")
    )
    self.repo.add_event(audit)
    self._commit()
    self.repo.refresh(created)

    owner_email = self.db.query(models.User.email).filter(models.User.id == final_owner_id).scalar()
    if owner_email:
      send_incident_alert_email.delay(
        to_email=owner_email,
        incident_title=created.title,
        incident_id=str(created.id),
        severity=str(created.severity)
      )

    return created

  def transition_incident(self, incident_id: UUID, data: schemas.TransitionRequest, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    if not can_transition(incident.status, data.new_state):
      raise HTTPException(status_code=400, detail=f"Invalid transition from {incident.status} to {data.new_state}")

    old_state = incident.status
    incident.status = data.new_state

    if data.new_state in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
      if not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    elif data.new_state == IncidentStatus.INVESTIGATING:
      incident.resolved_at = None

    self.repo.flush()
    self.repo.refresh(incident)

    audit = models.IncidentEvent(
      incident_id=incident.id,
      actor_id=user.id,
      organization_id=org_id,
      event_type="STATUS_CHANGE",
      old_value=old_state,
      new_value=data.new_state,
      comment=data.comment or f"State changed from {old_state} to {data.new_state}"
    )
    self.repo.add_event(audit)
    self._commit()
    return incident

  def update_incident(self, incident_id: UUID, data: schemas.IncidentUpdate, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    changes = []

    if data.severity and data.severity != incident.severity:
      old_severity = incident.severity.value if hasattr(incident.severity, "value") else str(incident.severity)
      changes.append(("SEVERITY_CHANGE", old_severity, data.severity.value))
      incident.severity = data.severity

    if data.owner_id and data.owner_id != incident.owner_id:
      if user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to reassign incidents")
      changes.append(("OWNER_CHANGE", str(incident.owner_id), str(data.owner_id)))
      incident.owner_id = data.owner_id

    self.repo.flush()
    self.repo.refresh(incident)

    for event_type, old_val, new_val in changes:
      audit = models.IncidentEvent(
        incident_id=incident.id,
        actor_id=user.id,
        organization_id=org_id,
        event_type=event_type,
        old_value=old_val,
        new_value=new_val,
        comment=data.comment or f"{event_type} from {old_val} to {new_val}"
      )
      self.repo.add_event(audit)

    self._commit()
    return incident

  def delete_incident(self, incident_id: UUID, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    if user.role not in ["ADMIN", "MANAGER"]:
      raise HTTPException(status_code=403, detail="Not authorized to delete incidents")

    self.repo.delete_entity(incident)
    self._commit()
    return {"message": "Incident deleted successfully"}

  def add_comment(self, incident_id: UUID, data: schemas.CommentRequest, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    audit = models.IncidentEvent(
      incident_id=incident.id,
      actor_id=user.id,
      organization_id=org_id,
      event_type="COMMENT",
      comment=data.comment
    )
    self.repo.add_event(audit)
    self._commit()
    return {"message": "Comment added"}

  def get_incident_events(self, incident_id: UUID, org_id: UUID) -> List[models.IncidentEvent]:
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    return self.repo.get_events(incident_id, org_id)
