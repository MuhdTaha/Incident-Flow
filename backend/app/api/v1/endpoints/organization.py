from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.schemas import organization as org_schemas
from app.services.org_service import OrganizationService
from app.services.user_service import UserService
from app.api.deps import get_current_user_id_from_token, get_current_org_id, get_user_service, require_admin
from app.db import models

router = APIRouter()

def get_org_service(db: Session = Depends(get_db)) -> OrganizationService:
  return OrganizationService(db)

@router.get("/org_profile", response_model=org_schemas.OrgProfile)
def get_org_profile(
  service: OrganizationService = Depends(get_org_service),
  current_org_id: UUID = Depends(get_current_org_id) 
):
  """Get the current organization's profile information."""
  return service.get_org(current_org_id)

@router.post("/register", response_model=org_schemas.OrgRegistrationResponse)
def register_organization(
  request: org_schemas.OrgCreate,
  # Inject the raw token data (because User doesn't exist in DB yet)
  token_data: dict = Depends(get_current_user_id_from_token),
  service: OrganizationService = Depends(get_org_service)
):
  """
  Complete the signup process.
  1. User signs up on Frontend (Supabase).
  2. Frontend sends Org Name + JWT.
  3. We create Org + User record here.
  """
  # For now, default the full name to the email prefix or pass it from frontend
  full_name = token_data["email"].split("@")[0]
  
  org, user = service.register_new_org(
    org_name=request.name,
    user_id=token_data["id"],
    admin_email=token_data["email"],
    admin_name=full_name 
  )
  
  return {"organization": org, "user": user}

@router.post("/invite", response_model=org_schemas.InviteResponse)
def invite_user(
  request: org_schemas.InviteRequest,
  service: OrganizationService = Depends(get_org_service),
  current_org_id: UUID = Depends(get_current_org_id),
  current_user: models.User = Depends(require_admin)
):
  """
  Invite a new member to the organization.
  """
  new_user_id = service.invite_user(request.email, request.role, current_org_id)
  
  return {
    "message": f"Invitation sent to {request.email}",
    "user_id": new_user_id
  }