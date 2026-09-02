from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.db import models
from app.schemas import user as user_schemas
from app.api.deps import get_current_user, get_current_org_id, get_user_service, require_admin
from app.services.user_service import UserService

router = APIRouter()

def _current_user_read(user: models.User) -> user_schemas.CurrentUserRead:
  return user_schemas.CurrentUserRead(
    id=user.id,
    role=user.role,
    org_id=user.organization_id,
    full_name=user.full_name,
  )


@router.get("/me", response_model=user_schemas.CurrentUserRead)
def get_me(current_user: models.User = Depends(get_current_user)):
  return _current_user_read(current_user)


@router.patch("/me", response_model=user_schemas.CurrentUserRead)
def update_me(
  request: user_schemas.UserUpdate,
  current_user: models.User = Depends(get_current_user),
  service: UserService = Depends(get_user_service),
):
  updated = service.update_me(current_user, request)
  return _current_user_read(updated)

@router.get("/", response_model=List[user_schemas.UserRead])
def get_users(
  service: UserService = Depends(get_user_service),
  current_org_id: UUID = Depends(get_current_org_id)
):
  return service.list_users(org_id=current_org_id)

@router.patch("/{user_id}/role")
def update_user_role(
  user_id: UUID,
  request: user_schemas.RoleUpdate,
  service: UserService = Depends(get_user_service),
  current_user: models.User = Depends(get_current_user),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    service.update_role(user_id, request, current_user.id, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(user_id), "message": "User role updated successfully"}

@router.delete("/{user_id}")
def delete_user(
  user_id: UUID, 
  service: UserService = Depends(get_user_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    service.delete_user(user_id, current_user.id, current_org_id)
  except HTTPException as he:
    raise he
  return {"id": str(user_id), "message": "User deleted successfully"}