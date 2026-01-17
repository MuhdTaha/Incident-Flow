# backend/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, computed_field, Field
from typing import Optional, List
from database import get_db, engine
from uuid import UUID
import models
import os
from datetime import datetime
from fsm import can_transition, IncidentStatus, VALID_TRANSITIONS
from deps import get_current_user, RoleChecker

# Create tables (for local dev; in prod use Alembic)
models.Base.metadata.create_all(bind=engine)

if os.getenv("TESTING") != "True":
  models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# --- Schemas ---
class TransitionRequest(BaseModel):
  new_state: IncidentStatus
  comment: Optional[str] = None
  
class CommentRequest(BaseModel):
  comment: str
  
class IncidentCreate(BaseModel):
  title: str
  description: str
  severity: models.IncidentSeverity
  owner_id: Optional[UUID] = None

class UserRead(BaseModel):
  id: UUID
  full_name: str
  role: str
  
  class Config:
    from_attributes = True

class IncidentRead(BaseModel):
  id: UUID
  title: str
  description: str
  severity: str
  status: str
  owner_id: UUID
  updated_at: datetime
  
  @computed_field
  @property
  def allowed_transitions(self) -> List[str]:
    return VALID_TRANSITIONS.get(IncidentStatus(self.status), [])
  
  class Config:
    from_attributes = True
    
require_admin = RoleChecker(["ADMIN"])
require_manager = RoleChecker(["ADMIN", "MANAGER"])

# --- Endpoints ---

# Create a new incident with initial audit log
@app.post("/incidents", response_model=dict)
def create_incident(
  incident: IncidentCreate, 
  db: Session = Depends(get_db), 
  current_user: models.User = Depends(get_current_user)
):
  try:
    # RBAC Logic for Assignment
    final_owner_id = current_user.id
    
    if incident.owner_id:
      if incident.owner_id != current_user.id:
        if current_user.role not in ["ADMIN", "MANAGER"]:
          raise HTTPException(status_code=403, detail="Not authorized to assign incidents to others")
        
        final_owner_id = incident.owner_id
    
    # 1. Create the Incident Record
    new_incident = models.Incident(
      title=incident.title,
      description=incident.description,
      severity=incident.severity,
      owner_id=final_owner_id,
      status=models.IncidentStatus.DETECTED
    )
    
    db.add(new_incident)
    db.flush()  # To get the ID
    
    # 2. Create Initial Audit Log
    audit_log = models.IncidentEvent(
      incident_id=new_incident.id,
      actor_id=current_user.id,
      event_type="CREATION",
      old_value=None,
      new_value=models.IncidentStatus.DETECTED,
      comment=f"Incident declared by {current_user.full_name}" + 
            (f" (Assigned to {final_owner_id})" if final_owner_id != current_user.id else "")
    )
    
    db.add(audit_log)
    db.commit()
    
    return {"id": str(new_incident.id), "message": "Incident created successfully"}
  
  except HTTPException as he:
    raise he
  except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))


# Transition Incident State with Audit Logging
@app.post("/incidents/{incident_id}/transition")
def transition_incident(
  incident_id: UUID, 
  request: TransitionRequest, 
  db: Session = Depends(get_db), 
  current_user: models.User = Depends(get_current_user)
):
  # 1. Fetch Incident
  incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
  if not incident:
    raise HTTPException(status_code=404, detail="Incident not found")

  # 2. Validate Transition (FSM Logic)
  if not can_transition(incident.status, request.new_state):
    raise HTTPException(
      status_code=400,
      detail=f"Invalid transition: Cannot move from {incident.status} to {request.new_state}"
    )

  # 3. Atomic Transaction
  # We prepare both the update and the audit log before committing.
  try:
    old_state = incident.status
    
    # A. Update the Source of Truth
    incident.status = request.new_state
    
    # B. Insert Immutable Audit Log
    audit_log = models.IncidentEvent(
      incident_id=incident.id,
      actor_id=current_user.id,
      event_type="STATUS_CHANGE",
      old_value=old_state,
      new_value=request.new_state,
      comment=request.comment or f"State changed from {old_state} to {request.new_state}"
    )
    db.add(audit_log)
    
    # C. Commit both as a single unit of work
    db.commit()
    db.refresh(incident)
      
  except Exception as e:
    # Rollback in case of error
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))

  return {"id": incident.id, "status": incident.status, "message": "Transition successful"}


# Post for comments on an incident
@app.post("/incidents/{incident_id}/comment")
def comment_on_incident(
  incident_id: UUID, 
  request: CommentRequest, 
  db: Session = Depends(get_db), 
  current_user: models.User = Depends(get_current_user)
): 
  # 1. Fetch Incident
  incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
  if not incident:
    raise HTTPException(status_code=404, detail="Incident not found")
  
  try:
    # 2. Insert Immutable Audit Log for Comment
    audit_log = models.IncidentEvent(
      incident_id=incident.id,
      actor_id=current_user.id,
      event_type="COMMENT",
      comment=request.comment
    )
    db.add(audit_log)
    db.commit()
    
  except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": incident.id, "message": "Comment added successfully"}


# Get list of incidents for dashboard
@app.get("/incidents", response_model=List[IncidentRead])
def get_incidents(db: Session = Depends(get_db)):
  # Simple fetch for the dashboard
  return db.query(models.Incident).all()

# Get audit logs for an incident
@app.get("/incidents/{incident_id}/events")
def get_incident_events(incident_id: UUID, db: Session = Depends(get_db)):
  # Fetch audit logs for an incident
  return db.query(models.IncidentEvent)\
    .filter(models.IncidentEvent.incident_id == incident_id)\
    .order_by(models.IncidentEvent.created_at.desc())\
    .all()
  
  
# Get list of users
@app.get("/users", response_model=List[UserRead])
def get_users(db: Session = Depends(get_db)):
  try:
    users = db.query(models.User).all()
    return users
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))