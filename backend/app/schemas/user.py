from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.db.models import UserRole

# Base schema with shared fields
class UserBase(BaseModel):
  email: EmailStr
  full_name: str
  role: UserRole = UserRole.ENGINEER
  phone_number: Optional[str] = None

class UserCreate(UserBase):
  pass # In future, might add password here

class UserUpdate(BaseModel):
  full_name: Optional[str] = None
  role: Optional[UserRole] = None
  phone_number: Optional[str] = None

class UserRead(UserBase):
  id: UUID
  organization_id: UUID
  created_at: datetime
  
  class Config:
    from_attributes = True

class CurrentUserRead(BaseModel):
  """Auth identity is the Supabase JWT; authorization (role/org) comes from our DB."""
  id: UUID
  role: UserRole
  org_id: UUID
  full_name: str
  invite_pending: bool = False

  class Config:
    from_attributes = True
    
# Admin Dashboard Read (for /admin/stats)
class UserWithStats(UserRead):
  incident_count: int = 0

class RoleUpdate(BaseModel):
  role: UserRole