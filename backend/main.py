# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
import os
import time
from storage import create_presigned_post, BUCKET_NAME, S3_EXTERNAL_ENDPOINT, get_s3_client

# Refactored Schemas
from app.schemas.incident import IncidentCreate, IncidentRead, TransitionRequest, CommentRequest, IncidentUpdate
from app.schemas.user import UserRead, RoleUpdate
from app.schemas.attachment import AttachmentSignRequest, AttachmentCompleteRequest, AttachmentRead
from app.schemas.analytics import UserStats, AdminDashboardStats, VolumeTrendPoint, AnalyticsResponse
from app.schemas.common import OrgProfile

import app.models as models
from app.api.deps import get_current_user, get_current_org_id, require_admin, require_manager
from app.services.incident_service import IncidentService
from app.services.user_service import UserService
from app.services.analytics_service import AnalyticsService
from app.services.attachment_service import AttachmentService
from app.repositories.incident_repo import IncidentRepository
from app.db.session import get_db

# No need to create tables here as Alembic handles migrations
# if os.getenv("TESTING") != "True":
#   models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

router = APIRouter()

# --- Dependency Helper ---

def get_incident_service(db: Session = Depends(get_db)) -> IncidentService:
  return IncidentService(db)

def get_user_service(db: Session = Depends(get_db)) -> UserService:
  return UserService(db)

def get_analytics_service(db: Session = Depends(get_db)) -> AnalyticsService:
  return AnalyticsService(db)

def get_attachment_service(db: Session = Depends(get_db)) -> AttachmentService:
  return AttachmentService(db)


# --- Incident Endpoints ---

@app.get("/incidents", response_model=List[IncidentRead])
def get_incidents(db: Session = Depends(get_db), current_org_id: UUID = Depends(get_current_org_id)):
  """
  List all incidents for the current organization.
  Direct Repo access is fine for simple reads (Skip Service overhead)
  """
  repo = IncidentRepository(db)
  if not repo:
    raise HTTPException(status_code=500, detail="Incident repository not available")
  
  return repo.get_all(org_id=current_org_id) 

@app.post("/incidents", response_model=dict)
def create_incident(
  incident: IncidentCreate, 
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Create a new incident. 
  RBAC logic for assigning to others is handled inside the Service.
  """
  
  new_incident = service.create_incident(incident, current_user, current_org_id)
  if not new_incident:
    raise HTTPException(status_code=500, detail="Failed to create incident")
  
  return {"id": str(new_incident.id), "message": "Incident created successfully"}

@app.post("/incidents/{incident_id}/transition")
def transition_incident(
  incident_id: UUID,
  request: TransitionRequest,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Transition an incident to a new state with RBAC and Audit Logging.
  """
  
  try:
    service.transition_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(incident_id), "message": f"Incident transitioned to {request.new_state} successfully"}
  
@app.patch("/incidents/{incident_id}")
def update_incident(
  incident_id: UUID,
  request: IncidentUpdate,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(require_manager),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Update incident details (severity, owner) with audit logging.
  """

  try:
    service.update_incident(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(incident_id), "message": "Incident updated successfully"}

@app.post("/incidents/{incident_id}/comment")
def comment_on_incident(
  incident_id: UUID, 
  request: CommentRequest,
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
): 
  """
  Add a comment to an incident with audit logging.
  """
  
  try:
    service.add_comment(incident_id, request, current_user, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(incident_id), "message": "Comment added successfully"}
  
@app.delete("/incidents/{incident_id}")
def delete_incident(
  incident_id: UUID, 
  service: IncidentService = Depends(get_incident_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Delete an incident. Only Admins can delete incidents.
  """
  
  try:
    service.delete_incident(incident_id, current_user, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(incident_id), "message": "Incident deleted successfully"}

@app.get("/incidents/{incident_id}/events")
def get_incident_events(
  incident_id: UUID, 
  service: IncidentService = Depends(get_incident_service),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Retrieve audit logs for a specific incident.
  """

  try:
    return service.get_incident_events(incident_id, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# --- User Endpoints ---

@app.get("/users", response_model=List[UserRead])
def get_users(
  service: UserService = Depends(get_user_service),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Return a list of users in the organization.
  """
  
  try:
    return service.list_users(org_id=current_org_id)
  except Exception as e:
    raise HTTPException(status_code=500, detail="Failed to fetch users")

@app.patch("/users/{user_id}/role")
def update_user_role(
  user_id: UUID,
  request: RoleUpdate,
  service: UserService = Depends(get_user_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Update a user's role with business rule enforcement.
  """
  
  try:
    service.update_role(user_id, request, current_user.id, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(user_id), "message": "User role updated successfully"}

@app.delete("/users/{user_id}")
def delete_user(
  user_id: UUID, 
  service: UserService = Depends(get_user_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Delete a user with business rule enforcement.
  """
  
  try:
    service.delete_user(user_id, current_user.id, current_org_id)
  except HTTPException as he:
    raise he
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
  
  return {"id": str(user_id), "message": "User deleted successfully"}

    
# --- Organization Endpoint ---

@app.get("/organization", response_model=OrgProfile)
def get_org_profile(
  service: UserService = Depends(get_user_service),
  current_org_id: UUID = Depends(get_current_org_id) 
):
  """
  Retrieve organization profile details.
  """
  return service.get_org(current_org_id)


# --- Admin Endpoint ---

@app.get("/admin/stats", response_model=AdminDashboardStats)
def get_admin_stats(
  service: AnalyticsService = Depends(get_analytics_service),
  current_user: models.User = Depends(require_admin), 
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Retrieve aggregated statistics for the admin dashboard.
  """
  try:
    return service.get_admin_dashboard_stats(current_org_id)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

  
@app.get("/admin/analytics")
def get_analytics(
  service: AnalyticsService = Depends(get_analytics_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  """
  Retrieve analytics charts data for the admin dashboard.
  """
  try:
    return service.get_analytics_charts(current_org_id)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# --- Attachments Endpoints ---

@app.get("/incidents/{incident_id}/attachments", response_model=List[AttachmentRead])
def list_attachments(
  incident_id: UUID,
  service: AttachmentService = Depends(get_attachment_service),
  org_id: UUID = Depends(get_current_org_id)
):
  """
  List all attachments for a specific incident.
    1. Verify incident ownership.
    2. Fetch attachments from the repository.
    3. Format and return attachment details with URLs.
  """
  return service.get_incident_attachments(incident_id, org_id)

@app.delete("/incidents/{incident_id}/attachments/{attachment_id}")
def delete_attachment(
  incident_id: UUID,
  attachment_id: UUID,
  service: AttachmentService = Depends(get_attachment_service),
  user: models.User = Depends(get_current_user),
  org_id: UUID = Depends(get_current_org_id)
):
  """
  Delete an attachment from an incident.
    1. Verify attachment existence and incident ownership.
    2. Enforce RBAC (Admin or uploader only).
    3. Delete from S3 and database.
  """
  return service.remove_attachment(attachment_id, incident_id, org_id, user)

@app.post("/incidents/{incident_id}/attachments/sign")
def sign_upload(
  incident_id: UUID, 
  request: AttachmentSignRequest,
  service: AttachmentService = Depends(get_attachment_service),
  org_id: UUID = Depends(get_current_org_id)
):
  """
  Generate a presigned URL for uploading an attachment to an incident.
    1. Verify incident ownership.
    2. Generate presigned POST data.
    3. Return presigned data to client.
  """
  return service.generate_upload_url(incident_id, org_id, request.file_name)

@app.post("/incidents/{incident_id}/attachments/complete")
def complete_upload(
    incident_id: UUID,
    request: AttachmentCompleteRequest,
    service: AttachmentService = Depends(get_attachment_service),
    user: models.User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id)
):
  """
  Register the uploaded attachment in the database.
    1. Verify incident ownership.
    2. Create IncidentAttachment record.
    3. Return attachment details.
  """
  return service.register_attachment(incident_id, org_id, user.id, request)