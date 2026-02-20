from pydantic import BaseModel
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime
from .user import UserRead

class UserStats(UserRead):
  incident_count: Optional[int] = None
  
class DetailedUserStats(BaseModel):
  id: UUID
  full_name: str
  email: str
  role: str
  assigned_count: int = 0
  resolved_count: int = 0
  comments_made: int = 0
  breached_incidents: int = 0
  escalations_triggered: int = 0

class AdminDashboardStats(BaseModel):
  total_users: int
  total_incidents: int
  active_incidents: int
  incidents_by_severity: Dict[str, int] # e.g. {"SEV1": 5}
  user_performance: List[DetailedUserStats]

class VolumeTrendPoint(BaseModel):
  date: str
  count: int

class AnalyticsResponse(BaseModel):
  time_window_days: int
  mttr_hours: float
  mtta_minutes: float
  sla_breach_rate: float
  total_breaches: int
  volume_trend: List[VolumeTrendPoint]