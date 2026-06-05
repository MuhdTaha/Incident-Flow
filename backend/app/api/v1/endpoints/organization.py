from fastapi import APIRouter, Depends
from uuid import UUID

from app.schemas import organization as org_schemas
from app.api.deps import (
  get_current_user_id_from_token,
  get_current_org_id,
  get_org_service,
  require_admin,
)
from app.db import models
from app.services.org_service import OrganizationService

router = APIRouter()

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
  token_data: dict = Depends(get_current_user_id_from_token),
  service: OrganizationService = Depends(get_org_service)
):
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
  new_user_id = service.invite_user(request.email, request.role, current_org_id)

  return {
    "message": f"Invitation sent to {request.email}",
    "user_id": new_user_id
  }
