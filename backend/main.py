# backend/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
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
    
class IncidentUpdate(BaseModel):
  severity: Optional[str] = None
  owner_id: Optional[str] = None
  comment: Optional[str] = None

require_admin = RoleChecker(["ADMIN"])
require_manager = RoleChecker(["ADMIN", "MANAGER"])

# --- Admin Schemas ---
class UserStats(BaseModel):
  id: UUID
  full_name: str
  email: str
  role: str
  created_at: datetime
  incident_count: int # How many incidents they own
  
class AdminDashboardStats(BaseModel):
  total_users: int
  total_incidents: int
  active_incidents: int # Status != CLOSED
  incidents_by_severity: dict # {"SEV1": 5, "SEV2": 2...}
  users: List[UserStats]
  
class RoleUpdate(BaseModel):
  role: str # "ADMIN", "MANAGER", "ENGINEER"


# --- Admin Endpoint ---
@app.get("/admin/stats", response_model=AdminDashboardStats)
def get_admin_stats(db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
  # 1. High Level Stats
  total_users = db.query(models.User).count()
  total_incidents = db.query(models.Incident).count()
  active_incidents = db.query(models.Incident).filter(models.Incident.status != models.IncidentStatus.CLOSED).count()
  
  # 2. Incidents by Severity
  sev_counts = db.query(models.Incident.severity, func.count(models.Incident.id)
  ).group_by(models.Incident.severity).all()
  
  # Convert [('SEV1', 5), ('SEV2', 2)] -> {'SEV1': 5, 'SEV2': 2}
  sev_dict = {sev: count for sev, count in sev_counts}
  
  # 3. User Stats with Incident Counts (Outer Join so users with 0 incidents are included)
  user_data = db.query(
    models.User,
    func.count(models.Incident.id).label("incident_count")
  ).outerjoin(models.Incident, models.User.id == models.Incident.owner_id)\
    .group_by(models.User.id)\
    .all()
    
  # Format the user stats
  users_formatted = []
  
  for user, incident_count in user_data:
    users_formatted.append(
      UserStats(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        incident_count=incident_count
      )
    )
  
  return AdminDashboardStats(
    total_users=total_users,
    total_incidents=total_incidents,
    active_incidents=active_incidents,
    incidents_by_severity=sev_dict,
    users=users_formatted
  )

@app.patch("/users/{user_id}/role")
def update_user_role(
  user_id: UUID,
  request: RoleUpdate,
  db: Session = Depends(get_db),
  current_user: models.User = Depends(require_admin)
):
  # 1. Fetch User
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")

  # 2. Check if admin is trying to change their own role
  if user.id == current_user.id:
    raise HTTPException(status_code=400, detail="Admins cannot change their own role")
  
  user.role = request.role
  db.commit()
  db.refresh(user)
  
  return {"id": user.id, "role": user.role, "message": "Role updated successfully"}

@app.delete("/users/{user_id}")
def delete_user(
  user_id: UUID, 
  db: Session = Depends(get_db),
  current_user: models.User = Depends(require_admin)
):
  # 1. Prevent admin from deleting themselves
  if user_id == current_user.id:
    raise HTTPException(status_code=400, detail="Admins cannot delete their own account")
  
  # 2. Fetch User
  user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
  if not user_to_delete:
    raise HTTPException(status_code=404, detail="User not found")
  
  try:
    # 3. Reassign Incidents and Incident Events owned by this user to None
    db.query(models.Incident).filter(models.Incident.owner_id == user_id).update({models.Incident.owner_id: None})
    db.query(models.IncidentEvent).filter(models.IncidentEvent.actor_id == user_id).update({models.IncidentEvent.actor_id: None})
    
    # 4. Delete User
    db.delete(user_to_delete)
    db.commit()
  except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": user_to_delete.id, "message": "User deleted successfully"}
  
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
  
# Update incident details (severity, owner) with audit logging
@app.patch("/incidents/{incident_id}")
def update_incident(
  incident_id: str, 
  request: IncidentUpdate, 
  db: Session = Depends(get_db), 
  current_user: models.User = Depends(require_manager)
):
  
  incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
  if not incident:
    raise HTTPException(status_code=404, detail="Incident not found")
  
  try:
    # Track changes for audit logging
    changes = []
    
    # Update Severity if provided
    if request.severity and request.severity != incident.severity:
      old_sev = incident.severity
      incident.severity = request.severity
      changes.append((
        "SEVERITY_CHANGE", 
        old_sev, 
        request.severity
      ))
    
    # Update Owner if provided
    if request.owner_id and str(request.owner_id) != str(incident.owner_id):
      old_owner = str(incident.owner_id)
      incident.owner_id = request.owner_id
      changes.append((
        "OWNER_CHANGE", 
        old_owner, 
        str(request.owner_id)
      ))
    
    # Create audit logs for each change
    for change in changes:
      event_type, old_value, new_value = change
      audit_log = models.IncidentEvent(
        incident_id=incident.id,
        actor_id=current_user.id,
        event_type=event_type,
        old_value=old_value,
        new_value=new_value,
        comment=request.comment or f"{event_type} from {old_value} to {new_value}"
      )
      db.add(audit_log)
    
    db.commit()
    db.refresh(incident)
    
  except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": incident.id, "message": "Incident updated successfully"}

# Delete an incident (Admin only)
@app.delete("/incidents/{incident_id}")
def delete_incident(
  incident_id: UUID, 
  db: Session = Depends(get_db), 
  current_user: models.User = Depends(require_admin)
):
  
  incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
  if not incident:
    raise HTTPException(status_code=404, detail="Incident not found")
  
  try:
    db.delete(incident)
    db.commit()
  except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": incident_id, "message": "Incident deleted successfully"}