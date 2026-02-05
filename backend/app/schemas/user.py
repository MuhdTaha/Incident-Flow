from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models import UserRole

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
    
# Admin Dashboard Read (for /admin/stats)
class UserWithStats(UserRead):
  incident_count: int = 0

class RoleUpdate(BaseModel):
  role: UserRole