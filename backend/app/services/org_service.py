# backend/app/services/org_service.py

import os
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.db import models
from app.repositories.user_repo import UserRepository
from app.core.supabase_admin import (
  EmailAlreadyRegistered,
  delete_auth_user,
  generate_invite_link,
  get_auth_user_id_by_email,
)
from app.core.invite_email import send_org_invite_email

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
    self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

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

  def _raise_if_email_taken(self, existing: models.User | None, org_id: UUID):
    if not existing:
      return
    if existing.organization_id == org_id:
      raise HTTPException(
        status_code=409,
        detail="This person is already in your workspace.",
      )
    raise HTTPException(
      status_code=409,
      detail="This email already belongs to another organization. Each account can only join one workspace.",
    )

  def _http_status_for_supabase_error(self, message: str) -> int:
    lowered = message.lower()
    if any(token in lowered for token in ("required", "publishable", "placeholder", "anon")):
      return 501
    return 400

  def _invite_via_supabase(self, email: str, org_id: UUID) -> tuple[str, str]:
    return generate_invite_link(
      email,
      redirect_to=f"{self.frontend_url}/invite",
      user_metadata={"org_id": str(org_id)},
    )

  def _reinvite_orphaned_auth_user(self, email: str, org_id: UUID) -> tuple[str, str]:
    """Auth still has this email after a local delete. Remove the leftover login and invite again."""
    existing = self.repo.get_by_email(email)
    self._raise_if_email_taken(existing, org_id)

    auth_id = get_auth_user_id_by_email(email)
    if auth_id:
      existing_by_id = self.repo.get_by_id_global(UUID(str(auth_id)))
      self._raise_if_email_taken(existing_by_id, org_id)
      delete_auth_user(auth_id)

    try:
      return self._invite_via_supabase(email, org_id)
    except EmailAlreadyRegistered as e:
      raise HTTPException(
        status_code=409,
        detail="This email is still registered in Auth. Delete it in the Supabase dashboard, then invite again.",
      ) from e

  def invite_user(self, email: str, role: models.UserRole, org_id: UUID):
    if role not in INVITABLE_ROLES:
      raise HTTPException(status_code=400, detail="Role must be ENGINEER, MANAGER, or ADMIN")

    email = str(email).strip().lower()
    self._raise_if_email_taken(self.repo.get_by_email(email), org_id)

    try:
      user_id, action_link = self._invite_via_supabase(email, org_id)
    except EmailAlreadyRegistered:
      try:
        user_id, action_link = self._reinvite_orphaned_auth_user(email, org_id)
      except HTTPException:
        raise
      except RuntimeError as e:
        raise HTTPException(
          status_code=self._http_status_for_supabase_error(str(e)),
          detail=str(e),
        ) from e
    except RuntimeError as e:
      raise HTTPException(
        status_code=self._http_status_for_supabase_error(str(e)),
        detail=str(e),
      ) from e

    org = self.get_org(org_id)
    try:
      send_org_invite_email(email, org.name or "IncidentFlow", action_link)
    except Exception as e:
      try:
        delete_auth_user(str(user_id))
      except RuntimeError:
        pass
      raise HTTPException(
        status_code=502,
        detail=f"Invite user was created but the email could not be sent: {e}",
      ) from e

    try:
      new_user = models.User(
        id=UUID(str(user_id)),
        email=email.lower(),
        full_name=_display_name_from_email(email),
        role=role,
        invite_pending=True,
        organization_id=org_id
      )
      self.repo.add(new_user)
      self._commit()
      return new_user.id
    except Exception as e:
      self.db.rollback()
      raise HTTPException(status_code=400, detail=f"Failed to create local user record: {str(e)}")
