from typing import List
from uuid import UUID
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import models
from app.schemas import incident as incident_schemas
from app.api.deps import get_current_user, get_current_org_id, get_incident_service, require_manager, require_admin
from app.services.incident_service import IncidentService
from app.repositories.incident_repo import IncidentRepository
from app.db.session import get_db
from app.services.ai_service import AIService, AIServiceConfigError, AIServiceError

router = APIRouter()
logger = logging.getLogger(__name__)

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
  payload = {
    "id": str(new_incident.id),
    "title": new_incident.title,
    "description": new_incident.description,
    "severity": new_incident.severity.value if hasattr(new_incident.severity, "value") else str(new_incident.severity),
    "status": new_incident.status.value if hasattr(new_incident.status, "value") else str(new_incident.status),
    "owner_id": str(new_incident.owner_id) if new_incident.owner_id else None,
    "updated_at": new_incident.updated_at,
  }
  payload["message"] = "Incident created successfully"
  return payload

@router.post("/{incident_id}/transition")
def transition_incident(
  incident_id: UUID,
  request: incident_schemas.TransitionRequest,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    updated = service.transition_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  return {
    "id": str(incident_id),
    "status": updated.status.value,
    "message": f"Incident transitioned to {request.new_state} successfully"
  }

@router.patch("/{incident_id}")
def update_incident(
  incident_id: UUID,
  request: incident_schemas.IncidentUpdate,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(require_manager),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    updated = service.update_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  payload = {
    "id": str(updated.id),
    "title": updated.title,
    "description": updated.description,
    "severity": updated.severity.value if hasattr(updated.severity, "value") else str(updated.severity),
    "status": updated.status.value if hasattr(updated.status, "value") else str(updated.status),
    "owner_id": str(updated.owner_id) if updated.owner_id else None,
    "updated_at": updated.updated_at,
  }
  payload["message"] = "Incident updated successfully"
  return payload

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
  
@router.get("/{incident_id}/postmortem")
def get_incident_postmortem(
  incident_id: str,
  current_user: models.User = Depends(get_current_user)
):
  """
  Retrieves a previously generated post-mortem from MinIO storage.
  """
  try:
    saved_report = AIService.get_saved_post_mortem(incident_id)
    return {
      "incident_id": incident_id,
      **saved_report,
    }
  except ValueError as ve:
    raise HTTPException(status_code=404, detail=str(ve))
  except AIServiceError as ae:
    logger.exception("Post-mortem fetch error for incident %s", incident_id)
    raise HTTPException(status_code=502, detail=str(ae))
  except Exception:
    logger.exception("Unexpected post-mortem fetch error for incident %s", incident_id)
    raise HTTPException(status_code=500, detail="Post-mortem fetch failed")


@router.post("/{incident_id}/postmortem")
def generate_incident_postmortem(
  incident_id: str,
  db: Session = Depends(get_db),
  current_user: models.User = Depends(get_current_user)
):
  """
  Generates an AI-powered post-mortem using Groq and persists it to MinIO.
  """
  try:
    # Since Groq is so fast, we can run this synchronously in the request lifecycle
    markdown_report = AIService.generate_post_mortem(db, incident_id)
    storage_info = AIService.save_post_mortem(incident_id, markdown_report)

    return {
      "incident_id": incident_id,
      "report_markdown": markdown_report,
      **storage_info,
    }
  except ValueError as ve:
    raise HTTPException(status_code=404, detail=str(ve))
  except AIServiceConfigError as ce:
    logger.warning("Post-mortem AI config error for incident %s: %s", incident_id, ce)
    raise HTTPException(status_code=503, detail=str(ce))
  except AIServiceError as ae:
    logger.exception("Post-mortem AI provider error for incident %s", incident_id)
    raise HTTPException(status_code=502, detail=str(ae))
  except Exception:
    logger.exception("Unexpected post-mortem generation error for incident %s", incident_id)
    raise HTTPException(status_code=500, detail="AI Generation failed")