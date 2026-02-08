from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends

from app.db import models
from app.schemas import attachment as attachments_schemas
from app.api.deps import get_current_user, get_current_org_id, get_attachment_service
from app.services.attachment_service import AttachmentService

router = APIRouter()

# Note: We will mount this router with a prefix logic that handles "/incidents/{id}/attachments"
# or we can keep the full paths here. To make mounting cleaner, we will keep full paths relative to the root or incident.
# For simplicity in router.py, let's keep the explicit paths here.

@router.get("/{incident_id}/attachments", response_model=List[attachments_schemas.AttachmentRead])
def list_attachments(
  incident_id: UUID,
  service: AttachmentService = Depends(get_attachment_service),
  org_id: UUID = Depends(get_current_org_id)
):
  return service.get_incident_attachments(incident_id, org_id)

@router.delete("/{incident_id}/attachments/{attachment_id}")
def delete_attachment(
  incident_id: UUID,
  attachment_id: UUID,
  service: AttachmentService = Depends(get_attachment_service),
  user: models.User = Depends(get_current_user),
  org_id: UUID = Depends(get_current_org_id)
):
  return service.remove_attachment(attachment_id, incident_id, org_id, user)

@router.post("/{incident_id}/attachments/sign")
def sign_upload(
  incident_id: UUID, 
  request: attachments_schemas.AttachmentSignRequest,
  service: AttachmentService = Depends(get_attachment_service),
  org_id: UUID = Depends(get_current_org_id)
):
  return service.generate_upload_url(incident_id, org_id, request.file_name)

@router.post("/{incident_id}/attachments/complete")
def complete_upload(
  incident_id: UUID,
  request: attachments_schemas.AttachmentCompleteRequest,
  service: AttachmentService = Depends(get_attachment_service),
  user: models.User = Depends(get_current_user),
  org_id: UUID = Depends(get_current_org_id)
):
  return service.register_attachment(incident_id, org_id, user.id, request)