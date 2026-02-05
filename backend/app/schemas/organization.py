from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class OrgCreate(BaseModel):
  name: str
  slug: str

class OrgRead(BaseModel):
  id: UUID
  name: str
  slug: str
  created_at: datetime
  
  class Config:
    from_attributes = True

class OrgUpdate(BaseModel):
  name: Optional[str] = None