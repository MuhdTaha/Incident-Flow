# backend/app/api/deps.py

import os
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from uuid import UUID
from dotenv import load_dotenv
from jose import jwt, JWTError

from app.db.session import get_db
import app.db.models as models

from app.services.incident_service import IncidentService
from app.services.user_service import UserService
from app.services.analytics_service import AnalyticsService
from app.services.attachment_service import AttachmentService

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"

# This tells FastAPI: "Look for the header 'Authorization: Bearer <token>'"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=True)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
  """
  Decodes the JWT, extracts the User ID, and verifies they exist in our DB.
  """
  credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
  )
  
  try:
    if not SECRET_KEY:
      raise ValueError("SUPABASE_JWT_SECRET is not set")
          
    # 1. Decode the Token
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
    user_id: str = payload.get("sub") # 'sub' is the standard claim for User ID
    
    if user_id is None:
      raise credentials_exception
          
  except JWTError:
    raise credentials_exception

  # 2. Get User from Database (to check Role)
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if user is None:
    raise credentials_exception
      
  return user

def get_current_user_id_from_token(token: str = Depends(oauth2_scheme)) -> dict:
  """
  Decodes the JWT and extracts the User ID without hitting the database.
  Useful for operations that only need the User ID and not the full user object.
  """
  try:
    if not SECRET_KEY:
      raise ValueError("SUPABASE_JWT_SECRET is not set")
    
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
    user_id: str = payload.get("sub")
    email: str = payload.get("email")
    
    if user_id is None:
      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
      
    return {"id": user_id, "email": email}

  except JWTError:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

# --- Organization Checker ---
def get_current_org_id(current_user: models.User = Depends(get_current_user)) -> UUID:
  """
  Ensures the user belongs to an organization.
  """
  if not current_user.organization_id:
    raise HTTPException(status_code=403, detail="User is not part of an organization")
  return current_user.organization_id

# --- Role Checker Factory ---
class RoleChecker:
  def __init__(self, allowed_roles: List[str]):
    self.allowed_roles = allowed_roles

  def __call__(self, user: models.User = Depends(get_current_user)):
    if user.role not in self.allowed_roles:
      raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, 
        detail=f"Operation not permitted. Requires one of: {self.allowed_roles}"
      )
    return user

require_admin = RoleChecker(["ADMIN"])
require_manager = RoleChecker(["ADMIN", "MANAGER"])


# --- Dependency Helper ---

def get_incident_service(db: Session = Depends(get_db)) -> IncidentService:
  return IncidentService(db)

def get_user_service(db: Session = Depends(get_db)) -> UserService:
  return UserService(db)

def get_analytics_service(db: Session = Depends(get_db)) -> AnalyticsService:
  return AnalyticsService(db)

def get_attachment_service(db: Session = Depends(get_db)) -> AttachmentService:
  return AttachmentService(db)