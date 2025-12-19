from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, engine
import models
from fsm import can_transition, IncidentStatus

# Create tables (for local dev; in prod use Alembic)
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
  actor_id: str  # In a real app, this comes from the JWT Token
  comment: Optional[str] = None

# --- Endpoints ---

@app.post("/incidents/{incident_id}/transition")
def transition_incident(
  incident_id: str, 
  request: TransitionRequest, 
  db: Session = Depends(get_db)
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

  # 3. ENGINEERING HIGHLIGHT: Atomic Transaction
  # We prepare both the update and the audit log before committing.
  try:
    old_state = incident.status
    
    # A. Update the Source of Truth
    incident.status = request.new_state
    
    # B. Insert Immutable Audit Log
    audit_log = models.IncidentEvent(
      incident_id=incident.id,
      actor_id=request.actor_id,
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
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))

  return {"id": incident.id, "status": incident.status, "message": "Transition successful"}

@app.get("/incidents")
def get_incidents(db: Session = Depends(get_db)):
  # Simple fetch for the dashboard
  return db.query(models.Incident).all()

@app.get("/incidents/{incident_id}/events")
def get_incident_events(incident_id: str, db: Session = Depends(get_db)):
  # Fetch audit logs for an incident
  return db.query(models.IncidentEvent)\
    .filter(models.IncidentEvent.incident_id == incident_id)\
    .order_by(models.IncidentEvent.created_at.desc())\
    .all()