from uuid import UUID
from datetime import datetime
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.schemas import incident as schemas
from app.repositories.incident_repo import IncidentRepository
from app.core.tasks import send_incident_alert_email
from app.core.fsm import can_transition, IncidentStatus

class IncidentService:
  def __init__(self, db: Session):
    self.repo = IncidentRepository(db)
    # We keep db reference just in case we need cross-repo access (e.g. Users)
    self.db = db 

  def create_incident(self, data: schemas.IncidentCreate, user: models.User, org_id: UUID) -> models.Incident:
    # 1. RBAC Logic: Only Admins/Managers can assign to others
    final_owner_id = user.id
    if data.owner_id and data.owner_id != user.id:
      if user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to assign incidents to others")
      final_owner_id = data.owner_id
    
    # 2. Prepare Data
    new_incident = models.Incident(
      title=data.title,
      description=data.description,
      severity=data.severity.value,
      owner_id=final_owner_id,
      status=IncidentStatus.DETECTED,
      organization_id=org_id
    )
    
    # 3. Save to DB
    created = self.repo.create(new_incident)
    
    # 4. Create Audit Log (Creation Event)
    audit = models.IncidentEvent(
      incident_id=created.id,
      actor_id=user.id,
      organization_id=org_id,
      event_type="CREATION",
      new_value=IncidentStatus.DETECTED,
      comment=f"Incident declared by {user.full_name}" + 
          (f" (Assigned to {final_owner_id})" if final_owner_id != user.id else "")
    )
    self.repo.add_event(audit)
    
    # 5. Trigger Async Email
    # (We query the owner email quickly here to send the alert)
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
    # 1. Fetch
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    # 2. Validate FSM Transition
    if not can_transition(incident.status, data.new_state):
      raise HTTPException(status_code=400, detail=f"Invalid transition from {incident.status} to {data.new_state}")

    # 3. Update State & Timestamps
    old_state = incident.status
    incident.status = data.new_state
    
    if data.new_state in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
      if not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    elif data.new_state == IncidentStatus.INVESTIGATING:
      # If reopened, clear the resolution timestamp
      incident.resolved_at = None

    updated = self.repo.update(incident)

    # 4. Audit Log
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
    
    return updated
  
  def update_incident(self, incident_id: UUID, data: schemas.IncidentUpdate, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")
    
    changes = []
    
    # Check for severity change
    if data.severity and data.severity.value != incident.severity:
      changes.append(("SEVERITY_CHANGE", str(incident.severity), str(data.severity.value)))
      incident.severity = data.severity.value
      
    # Check for owner change
    if data.owner_id and data.owner_id != incident.owner_id:
      # RBAC Check
      if user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to reassign incidents")
      changes.append(("OWNER_CHANGE", str(incident.owner_id), str(data.owner_id)))
      incident.owner_id = data.owner_id
      
    updated = self.repo.update(incident)
    
    # Audit Logs for each change
    for event_type, old_val, new_val in changes:
      audit = models.IncidentEvent(
        incident_id=incident.id,
        actor_id=user.id,
        organization_id=org_id,
        event_type=event_type, # e.g., "SEVERITY_CHANGE"
        old_value=old_val,
        new_value=new_val,
        # Use the comment provided in the request, or generate a system one
        comment=data.comment or f"{event_type.lower()} from {old_val} to {new_val}"
      )

      self.repo.add_event(audit)
      
    return updated
  
  def delete_incident(self, incident_id: UUID, user: models.User, org_id: UUID):
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")
   
    # RBAC Check
    if user.role not in ["ADMIN", "MANAGER"]:
      raise HTTPException(status_code=403, detail="Not authorized to delete incidents") 
    self.repo.delete(incident)
  
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
    return {"message": "Comment added"}
  
  def get_incident_events(self, incident_id: UUID, org_id: UUID) -> List[models.IncidentEvent]:
    incident = self.repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")
    
    return self.repo.get_events(incident_id)