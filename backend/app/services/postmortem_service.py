from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.incident_repo import IncidentRepository
from app.services.ai_service import AIService, AIServiceConfigError, AIServiceError

class PostMortemService:
  def __init__(self, db: Session):
    self.incident_repo = IncidentRepository(db)

  def get_saved(self, incident_id: UUID, org_id: UUID) -> dict:
    if not self.incident_repo.get_by_id(incident_id, org_id):
      raise HTTPException(status_code=404, detail="Incident not found")

    org_str = str(org_id)
    inc_str = str(incident_id)
    saved = AIService.get_saved_post_mortem(org_str, inc_str)
    return {
      "incident_id": inc_str,
      **saved,
    }

  def generate(self, incident_id: UUID, org_id: UUID) -> dict:
    incident = self.incident_repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    events = self.incident_repo.get_events(incident_id, org_id)
    events_chronological = list(reversed(events))

    org_str = str(org_id)
    inc_str = str(incident_id)

    try:
      markdown_report = AIService.build_post_mortem_markdown(incident, events_chronological)
      storage_info = AIService.save_post_mortem(org_str, inc_str, markdown_report)
    except ValueError as ve:
      raise HTTPException(status_code=404, detail=str(ve)) from ve
    except AIServiceConfigError as ce:
      raise HTTPException(status_code=503, detail=str(ce)) from ce
    except AIServiceError as ae:
      raise HTTPException(status_code=502, detail=str(ae)) from ae

    return {
      "incident_id": inc_str,
      "report_markdown": markdown_report,
      **storage_info,
    }
