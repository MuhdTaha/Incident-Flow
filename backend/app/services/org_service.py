# backend/app/services/org_service.py

import os
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.db import models
from app.repositories.user_repo import UserRepository
from supabase import create_client, Client

class OrganizationService:
  def __init__(self, db: Session):
    self.db = db
    self.repo = UserRepository(db)
    self.supabase_url = os.getenv("SUPABASE_URL")
    self.supabase_key = os.getenv("SUPABASE_KEY")
    self.supabase = None
    
    # Only initialize Supabase if BOTH URL and KEY are present and non-empty
    if self.supabase_url and self.supabase_key:
      try:
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
      except Exception as e:
        # Log the error but don't crash - Supabase is only for invites, not required for signup
        print(f"Warning: Failed to initialize Supabase client: {e}")
        self.supabase = None
      
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
      # 1. Create Organization
      # Generate a slug from name (e.g., "Acme Corp" -> "acme-corp")
      slug = org_name.lower().replace(" ", "-")
      
      new_org = models.Organization(
        name=org_name,
        slug=slug
      )
      self.db.add(new_org)
      self.db.flush() # Flush to get the new_org.id for the user

      # 2. Handle User Creation / Claiming
      existing_user = self.db.query(models.User).filter(models.User.id == user_id).first()
      
      if existing_user:
        # SCENARIO A: User created by Supabase trigger
        existing_user.organization_id = new_org.id
        existing_user.full_name = admin_name
        existing_user.email = admin_email
        existing_user.role = "ADMIN"
        
        user_record = existing_user
      
      else:
        # SCENARIO B: User not created yet
        new_user = models.User(
          id=UUID(user_id),
          email=admin_email,
          full_name=admin_name,
          role="ADMIN",
          organization_id=new_org.id # <--- The critical link
        )
        
        self.db.add(new_user)
        user_record = new_user
        
      self.db.commit()
      self.db.refresh(new_org)
      self.db.refresh(user_record)
      
      return new_org, user_record
          
    except Exception as e:
      self.db.rollback()
      raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

  def invite_user(self, email: str, role: str, org_id: UUID):
    """"
    Invites a user to the organization by email using Supabase's auth system, and creates a local user record linked to the org.
    """
    if not self.supabase:
      raise HTTPException(status_code=501, detail="Supabase credentials not configured")
    
    try:
      # 1. Ask Supabase to create an invite for the email
      response = self.supabase.auth.admin.invite_user_by_email(email)
      user_id = response.user.id # Supabase generates a user ID for the invited user
    except Exception as e:
      raise HTTPException(status_code=400, detail=f"Supabase User invitation failed: {str(e)}")
    
    try:
      # 2. Create a local user record with the Supabase user ID and link to org
      new_user = models.User(
        id=user_id,
        email=email,
        full_name="temp", # We can update this later when the user accepts the invite
        role=role,
        organization_id=org_id
      )
      self.db.add(new_user)
      self.db.commit()
      
      return new_user.id
    except Exception as e:
      self.db.rollback()
      raise HTTPException(status_code=400, detail=f"Failed to create local user record: {str(e)}")
      