from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List

class OrgProfile(BaseModel):
  id: UUID
  name: str
  slug: str
  class Config:
    from_attributes = True

class UserStats(BaseModel):
  id: UUID
  full_name: str
  email: str
  role: str
  created_at: datetime
  incident_count: int

class AdminDashboardStats(BaseModel):
  total_users: int
  total_incidents: int
  active_incidents: int
  incidents_by_severity: dict
  users: List[UserStats]