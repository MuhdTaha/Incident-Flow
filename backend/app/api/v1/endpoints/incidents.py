from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.db.session import get_db
from app.api.deps import get_current_user, get_current_org_id
from app.schemas import incident as schemas
from app.models import User
from app.services.incident_service import IncidentService

router = APIRouter()

@router.post("/incidents", response_model=dict)
def create_incident(
  incident_in: schemas.IncidentCreate,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
  org_id: UUID = Depends(get_current_org_id)
):
  service = IncidentService(db)
  new_incident = service.create_incident(incident_in, current_user, org_id)
  return {"id": str(new_incident.id), "message": "Incident created successfully"}

@router.get("/", response_model=List[schemas.IncidentRead])
def get_incidents(
  db: Session = Depends(get_db),
  org_id: UUID = Depends(get_current_org_id)
):
  service = IncidentService(db)
  return service.repo.get_all(org_id)

@router.post("/{incident_id}/transition")
def transition_incident(
  incident_id: UUID,
  request: schemas.TransitionRequest,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
  org_id: UUID = Depends(get_current_org_id)
):
  service = IncidentService(db)
  result = service.transition_incident(incident_id, request, current_user, org_id)
  return {"id": result.id, "status": result.status, "message": "Transition successful"}