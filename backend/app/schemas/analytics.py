from pydantic import BaseModel
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime
from .user import UserRead

class UserStats(UserRead):
  incident_count: Optional[int] = None

class AdminDashboardStats(BaseModel):
  total_users: int
  total_incidents: int
  active_incidents: int
  incidents_by_severity: Dict[str, int] # e.g. {"SEV1": 5}
  users: List[UserStats]

class VolumeTrendPoint(BaseModel):
  date: str
  count: int

class AnalyticsResponse(BaseModel):
  mttr_hours: float
  volume_trend: List[VolumeTrendPoint]