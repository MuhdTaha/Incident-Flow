from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import models
from app.schemas import incident as incident_schemas
from app.api.deps import get_current_user, get_current_org_id, get_incident_service, require_manager, require_admin
from app.services.incident_service import IncidentService
from app.repositories.incident_repo import IncidentRepository
from app.db.session import get_db

router = APIRouter()

@router.get("/", response_model=List[incident_schemas.IncidentRead])
def get_incidents(db: Session = Depends(get_db), current_org_id: UUID = Depends(get_current_org_id)):
  repo = IncidentRepository(db)
  return repo.get_all(org_id=current_org_id)

@router.post("/", response_model=dict)
def create_incident(
  incident: incident_schemas.IncidentCreate, 
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  new_incident = service.create_incident(incident, current_user, current_org_id)
  return {"id": str(new_incident.id), "message": "Incident created successfully"}

@router.post("/{incident_id}/transition")
def transition_incident(
  incident_id: UUID,
  request: incident_schemas.TransitionRequest,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    service.transition_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(incident_id), "message": f"Incident transitioned to {request.new_state} successfully"}

@router.patch("/{incident_id}")
def update_incident(
  incident_id: UUID,
  request: incident_schemas.IncidentUpdate,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(require_manager),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    service.update_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(incident_id), "message": "Incident updated successfully"}

@router.post("/{incident_id}/comment")
def comment_on_incident(
  incident_id: UUID, 
  request: incident_schemas.CommentRequest,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
): 
  try:
    service.add_comment(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(incident_id), "message": "Comment added successfully"}

@router.delete("/{incident_id}")
def delete_incident(
  incident_id: UUID, 
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    service.delete_incident(incident_id, current_user, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(incident_id), "message": "Incident deleted successfully"}

@router.get("/{incident_id}/events")
def get_incident_events(
  incident_id: UUID, 
  service: IncidentService = Depends(get_incident_service),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    return service.get_incident_events(incident_id, current_org_id)
  except HTTPException as he:
    raise he