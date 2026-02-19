from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.schemas.common import OrgProfile
from app.schemas.user import UserRead

class OrgCreate(BaseModel):
  name: str

class OrgRegistrationResponse(BaseModel):
  organization: OrgProfile
  user: UserRead

class InviteRequest(BaseModel):
  email: EmailStr
  role: str = "ENGINEER"
  
class InviteResponse(BaseModel):
  message: str
  user_id: UUID

class OrgRead(BaseModel):
  id: UUID
  name: str
  slug: str
  created_at: datetime
  
  class Config:
    from_attributes = True

class OrgUpdate(BaseModel):
  name: Optional[str] = None
  slug: Optional[str] = None