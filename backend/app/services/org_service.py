# backend/app/services/org_service.py

import os
from uuid import UUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.db import models
from app.repositories.user_repo import UserRepository
from app.core.supabase_admin import (
  EmailAlreadyRegistered,
  auth_confirmation_state,
  delete_auth_user,
  generate_invite_link,
  get_auth_user_id_by_email,
)
from app.core.invite_email import send_org_invite_email
from app.core.constants import DEFAULT_ORG_ID, DEMO_PERSONA_EMAILS
from app.core.storage import delete_storage_keys
import re

INVITABLE_ROLES = {
  models.UserRole.ENGINEER,
  models.UserRole.MANAGER,
  models.UserRole.ADMIN,
}


def _display_name_from_email(email: str) -> str:
  local = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
  return local.title() if local else "New teammate"


def is_unclaimed_signup(user: models.User) -> bool:
  """True when Auth created a Default Org ENGINEER row instead of a real workspace."""
  if user.invite_pending:
    return False
  if user.organization_id != DEFAULT_ORG_ID:
    return False
  if user.role != models.UserRole.ENGINEER:
    return False
  return (user.email or "").lower() not in DEMO_PERSONA_EMAILS


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

  def _unique_org_slug(self, org_name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-") or "workspace"
    slug = base
    suffix = 2
    while self.db.query(models.Organization).filter(models.Organization.slug == slug).first():
      slug = f"{base}-{suffix}"
      suffix += 1
    return slug

  def _unique_org_name(self, org_name: str) -> str:
    name = org_name
    suffix = 2
    while self.db.query(models.Organization).filter(models.Organization.name == name).first():
      name = f"{org_name} ({suffix})"
      suffix += 1
    return name

  def register_new_org(self, org_name: str, user_id: str, admin_email: str, admin_name: str):
    """
    Creates an Organization and the first Admin User.
    Expected to be called AFTER Supabase Auth SignUp.
    """
    try:
      existing_user = self.repo.get_by_id_global(UUID(user_id))
      if existing_user and not is_unclaimed_signup(existing_user):
        raise HTTPException(
          status_code=400,
          detail="Account already exists. Sign in or use your invitation link.",
        )

      org_name = (org_name or "").strip()
      if not org_name:
        raise HTTPException(status_code=400, detail="Organization name is required")

      slug = self._unique_org_slug(org_name)
      name = self._unique_org_name(org_name)

      new_org = models.Organization(
        name=name,
        slug=slug
      )
      self.db.add(new_org)
      self.db.flush()

      if existing_user:
        existing_user.email = (admin_email or existing_user.email).lower()
        existing_user.full_name = admin_name or existing_user.full_name
        existing_user.role = models.UserRole.ADMIN
        existing_user.invite_pending = False
        existing_user.organization_id = new_org.id
        self.repo.flush()
        self._commit()
        self.db.refresh(new_org)
        self.db.refresh(existing_user)
        return new_org, existing_user

      new_user = models.User(
        id=UUID(user_id),
        email=(admin_email or "").lower(),
        full_name=admin_name,
        role=models.UserRole.ADMIN,
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

  def _existing_invitee_should_resend(self, existing: models.User, org_id: UUID) -> None:
    """Raise 409 if they already joined; otherwise caller should resend the invite."""
    if existing.organization_id != org_id:
      self._raise_if_email_taken(existing, org_id)
    if existing.invite_pending:
      return
    try:
      state = auth_confirmation_state(str(existing.id))
    except RuntimeError:
      self._raise_if_email_taken(existing, org_id)
      return
    if state == "unconfirmed":
      return
    self._raise_if_email_taken(existing, org_id)

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

  def _reinvite_orphaned_auth_user(
    self,
    email: str,
    org_id: UUID,
    *,
    replacing_pending: bool = False,
  ) -> tuple[str, str]:
    """Auth still has this email after a local delete. Remove the leftover login and invite again."""
    existing = self.repo.get_by_email(email)
    if not (replacing_pending and existing and existing.organization_id == org_id):
      self._raise_if_email_taken(existing, org_id)

    auth_id = get_auth_user_id_by_email(email)
    if auth_id:
      existing_by_id = self.repo.get_by_id_global(UUID(str(auth_id)))
      if not (replacing_pending and existing_by_id and existing_by_id.organization_id == org_id):
        self._raise_if_email_taken(existing_by_id, org_id)
      delete_auth_user(auth_id)

    try:
      return self._invite_via_supabase(email, org_id)
    except EmailAlreadyRegistered as e:
      raise HTTPException(
        status_code=409,
        detail="This email is still registered in Auth. Delete it in the Supabase dashboard, then invite again.",
      ) from e

  def _invite_or_reinvite(
    self,
    email: str,
    org_id: UUID,
    *,
    replacing_pending: bool = False,
  ) -> tuple[str, str]:
    try:
      return self._invite_via_supabase(email, org_id)
    except EmailAlreadyRegistered:
      try:
        return self._reinvite_orphaned_auth_user(
          email, org_id, replacing_pending=replacing_pending
        )
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

  def _email_invite(
    self,
    email: str,
    org_id: UUID,
    user_id: str,
    action_link: str,
    *,
    rollback_auth: bool,
  ) -> None:
    org = self.get_org(org_id)
    try:
      send_org_invite_email(email, org.name or "IncidentFlow", action_link)
    except Exception as e:
      if rollback_auth:
        try:
          delete_auth_user(str(user_id))
        except RuntimeError:
          pass
      raise HTTPException(
        status_code=502,
        detail=f"Invite user was created but the email could not be sent: {e}",
      ) from e

  def _insert_local_invitee(
    self,
    email: str,
    role: models.UserRole,
    org_id: UUID,
    user_id: str,
  ) -> UUID:
    new_user = models.User(
      id=UUID(str(user_id)),
      email=email,
      full_name=_display_name_from_email(email),
      role=role,
      invite_pending=True,
      organization_id=org_id,
    )
    try:
      self.repo.add(new_user)
      self._commit()
      return new_user.id
    except IntegrityError:
      self.db.rollback()
      existing = self.repo.get_by_id_global(UUID(str(user_id))) or self.repo.get_by_email(email)
      if (
        existing
        and existing.email.lower() == email
        and existing.organization_id == org_id
      ):
        if not existing.invite_pending:
          self._raise_if_email_taken(existing, org_id)
        existing.role = role
        existing.invite_pending = True
        self._commit()
        return existing.id
      raise HTTPException(
        status_code=409,
        detail="This person is already in your workspace.",
      )

  def _upsert_local_invitee(
    self,
    user: models.User,
    email: str,
    role: models.UserRole,
    org_id: UUID,
    user_id: str,
  ) -> UUID:
    new_id = UUID(str(user_id))
    if user.id != new_id:
      self.repo.delete_entity(user)
      self.db.flush()
      return self._insert_local_invitee(email, role, org_id, user_id)

    user.email = email
    user.role = role
    user.invite_pending = True
    user.organization_id = org_id
    self.repo.flush()
    self._commit()
    return user.id

  def invite_user(self, email: str, role: models.UserRole, org_id: UUID):
    if role not in INVITABLE_ROLES:
      raise HTTPException(status_code=400, detail="Role must be ENGINEER, MANAGER, or ADMIN")

    email = str(email).strip().lower()
    existing = self.repo.get_by_email(email)
    if existing:
      self._existing_invitee_should_resend(existing, org_id)
      user_id, action_link = self._invite_or_reinvite(
        email, org_id, replacing_pending=True
      )
      self._email_invite(email, org_id, user_id, action_link, rollback_auth=False)
      return self._upsert_local_invitee(existing, email, role, org_id, user_id)

    user_id, action_link = self._invite_or_reinvite(email, org_id)
    existing_by_id = self.repo.get_by_id_global(UUID(str(user_id)))
    if existing_by_id:
      if existing_by_id.email.lower() != email:
        if not existing_by_id.invite_pending or existing_by_id.organization_id != org_id:
          raise HTTPException(
            status_code=409,
            detail="This login is already linked to another teammate.",
          )
      elif not existing_by_id.invite_pending:
        self._raise_if_email_taken(existing_by_id, org_id)
      self._email_invite(email, org_id, user_id, action_link, rollback_auth=False)
      return self._upsert_local_invitee(existing_by_id, email, role, org_id, user_id)

    self._email_invite(email, org_id, user_id, action_link, rollback_auth=True)
    return self._insert_local_invitee(email, role, org_id, user_id)

  def delete_org(self, org_id: UUID, confirmation_name: str) -> None:
    org = self.get_org(org_id)
    if org.id == DEFAULT_ORG_ID:
      raise HTTPException(status_code=403, detail="The demo workspace cannot be deleted.")

    expected = (org.name or "").strip()
    provided = (confirmation_name or "").strip()
    if not provided or provided != expected:
      raise HTTPException(
        status_code=400,
        detail="Type the workspace name exactly to confirm deletion.",
      )

    file_keys = [
      row.file_key
      for row in self.db.query(models.IncidentAttachment).filter(
        models.IncidentAttachment.organization_id == org_id
      ).all()
    ]
    user_ids = [
      str(row.id)
      for row in self.db.query(models.User).filter(models.User.organization_id == org_id).all()
    ]

    try:
      delete_storage_keys(file_keys, prefixes=[f"orgs/{org_id}/"])
    except Exception:
      pass

    self.db.query(models.IncidentAttachment).filter(
      models.IncidentAttachment.organization_id == org_id
    ).delete(synchronize_session=False)
    self.db.query(models.IncidentEvent).filter(
      models.IncidentEvent.organization_id == org_id
    ).delete(synchronize_session=False)
    self.db.query(models.Incident).filter(
      models.Incident.organization_id == org_id
    ).delete(synchronize_session=False)
    self.db.query(models.User).filter(
      models.User.organization_id == org_id
    ).delete(synchronize_session=False)
    self.db.delete(org)
    self._commit()

    for user_id in user_ids:
      try:
        delete_auth_user(user_id)
      except RuntimeError:
        pass
