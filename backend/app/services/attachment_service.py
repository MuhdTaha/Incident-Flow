import time
from uuid import UUID
from fastapi import HTTPException
from pytest import Session
from app.repositories.attachment_repo import AttachmentRepository
from app.repositories.incident_repo import IncidentRepository
from app.core.storage import create_presigned_post, get_s3_client, BUCKET_NAME, S3_EXTERNAL_ENDPOINT
from app.models import IncidentAttachment, User

class AttachmentService:
  def __init__(self, db: Session):
    self.repo = AttachmentRepository(db)
    self.incident_repo = IncidentRepository(db)
    self.db = db

  def generate_upload_url(self, incident_id: UUID, org_id: UUID, file_name: str):
    # 1. Ownership check
    incident = self.incident_repo.get_by_id(incident_id, org_id)
    if not incident:
      raise HTTPException(status_code=404, detail="Incident not found")

    # 2. Logic for key generation
    clean_name = file_name.replace(" ", "_")
    file_key = f"incidents/{incident_id}/{int(time.time())}_{clean_name}"
    
    presigned_data = create_presigned_post(file_key)
    return {"data": presigned_data, "file_key": file_key}

  def register_attachment(self, incident_id: UUID, org_id: UUID, user_id: UUID, data):
    new_att = IncidentAttachment(
      incident_id=incident_id,
      organization_id=org_id,
      file_name=data.file_name,
      file_key=data.file_key,
      uploaded_by=user_id
    )
    return self.repo.create(new_att)

  def get_incident_attachments(self, incident_id: UUID, org_id: UUID):
    # Ensure incident exists/access allowed
    if not self.incident_repo.get_by_id(incident_id, org_id):
      raise HTTPException(status_code=404, detail="Incident not found")
    
    attachments = self.repo.list_by_incident(incident_id)
    
    # We can format the URLs here
    return [{
      "id": att.id,
      "file_name": att.file_name,
      "file_url": f"{S3_EXTERNAL_ENDPOINT}/{BUCKET_NAME}/{att.file_key}",
      "created_at": att.created_at,
      "uploaded_by": att.uploader.full_name if att.uploader else "Unknown"
    } for att in attachments]

  def remove_attachment(self, attachment_id: UUID, incident_id: UUID, org_id: UUID, current_user: User):
    att = self.repo.get_by_id(attachment_id, incident_id, org_id)
    if not att:
      raise HTTPException(status_code=404, detail="Attachment not found")

    # RBAC
    if current_user.role != "ADMIN" and att.uploaded_by != current_user.id:
      raise HTTPException(status_code=403, detail="Not authorized")

    # 1. Delete from S3 first (Non-blocking warning)
    try:
      get_s3_client().delete_object(Bucket=BUCKET_NAME, Key=att.file_key)
    except Exception as e:
      print(f"S3 Delete failed: {e}")

    # 2. Delete from DB
    self.repo.delete(att)