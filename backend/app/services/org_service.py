# backend/app/services/org_service.py

import os
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.db import models
from app.repositories.user_repo import UserRepository
from supabase import create_client, Client

INVITABLE_ROLES = {
  models.UserRole.ENGINEER,
  models.UserRole.MANAGER,
  models.UserRole.ADMIN,
}


def _display_name_from_email(email: str) -> str:
  local = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
  return local.title() if local else "New teammate"


class OrganizationService:
  def __init__(self, db: Session):
    self.db = db
    self.repo = UserRepository(db)
    self.supabase_url = os.getenv("SUPABASE_URL")
    self.supabase_key = os.getenv("SUPABASE_KEY")
    self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    self.supabase = None

    if self.supabase_url and self.supabase_key:
      try:
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
      except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        self.supabase = None

  def _commit(self):
    self.db.commit()

  def get_org(self, org_id: UUID):
    org = self.repo.get_org(org_id)
    if not org:
      raise HTTPException(status_code=404, detail="Organization not found")
    return org

  def register_new_org(self, org_name: str, user_id: str, admin_email: str, admin_name: str):
    """
    Creates an Organization and the first Admin User.
    Expected to be called AFTER Supabase Auth SignUp.
    """
    try:
      existing_user = self.repo.get_by_id_global(UUID(user_id))
      if existing_user:
        raise HTTPException(
          status_code=400,
          detail="Account already exists. Sign in or use your invitation link.",
        )

      slug = org_name.lower().replace(" ", "-")

      new_org = models.Organization(
        name=org_name,
        slug=slug
      )
      self.db.add(new_org)
      self.db.flush()

      new_user = models.User(
        id=UUID(user_id),
        email=admin_email,
        full_name=admin_name,
        role="ADMIN",
        organization_id=new_org.id
      )
      self.repo.add(new_user)
      self._commit()
      self.db.refresh(new_org)
      self.db.refresh(new_user)

      return new_org, new_user

    except HTTPException:
      self.db.rollback()
      raise
    except Exception as e:
      self.db.rollback()
      raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

  def invite_user(self, email: str, role: models.UserRole, org_id: UUID):
    if role not in INVITABLE_ROLES:
      raise HTTPException(status_code=400, detail="Role must be ENGINEER, MANAGER, or ADMIN")

    existing = self.repo.get_by_email(email)
    if existing:
      raise HTTPException(status_code=409, detail="A user with this email already exists")

    if not self.supabase:
      raise HTTPException(status_code=501, detail="Supabase credentials not configured")

    try:
      response = self.supabase.auth.admin.invite_user_by_email(
        email,
        {
          "redirect_to": f"{self.frontend_url}/invite",
          "data": {"org_id": str(org_id)},
        },
      )
      user_id = response.user.id
    except Exception as e:
      raise HTTPException(status_code=400, detail=f"Supabase User invitation failed: {str(e)}")

    try:
      new_user = models.User(
        id=UUID(str(user_id)),
        email=email.lower(),
        full_name=_display_name_from_email(email),
        role=role,
        organization_id=org_id
      )
      self.repo.add(new_user)
      self._commit()
      return new_user.id
    except Exception as e:
      self.db.rollback()
      raise HTTPException(status_code=400, detail=f"Failed to create local user record: {str(e)}")
