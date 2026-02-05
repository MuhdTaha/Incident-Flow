from uuid import UUID
from sqlalchemy.orm import Session
from app.schemas import analytics as schemas
from app.repositories.analytics_repo import AnalyticsRepository
from app.repositories.user_repo import UserRepository

class AnalyticsService:
  def __init__(self, db: Session):
    self.analytics_repo = AnalyticsRepository(db)
    self.user_repo = UserRepository(db)

  def get_admin_dashboard_stats(self, org_id: UUID) -> schemas.AdminDashboardStats:
    # 1. Fetch Raw Counts
    total_users = self.analytics_repo.get_total_users(org_id)
    total_incidents = self.analytics_repo.get_total_incidents(org_id)
    active_incidents = self.analytics_repo.get_active_incidents(org_id)
    
    # 2. Process Severity Counts
    sev_counts = self.analytics_repo.get_severity_counts(org_id)
    sev_dict = {sev: count for sev, count in sev_counts}
    
    # 3. Process User Table Stats
    # The repo returns a list of tuples: (UserObj, incident_count)
    raw_users = self.user_repo.get_user_stats(org_id)
    formatted_users = []
    for user, count in raw_users:
      formatted_users.append(schemas.UserStats(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        incident_count=count,
        organization_id=user.organization_id
      ))
        
    return schemas.AdminDashboardStats(
      total_users=total_users,
      total_incidents=total_incidents,
      active_incidents=active_incidents,
      incidents_by_severity=sev_dict,
      users=formatted_users
    )

  def get_analytics_charts(self, org_id: UUID) -> schemas.AnalyticsResponse:
    # 1. Calculate MTTR
    avg_seconds = self.analytics_repo.calculate_mttr_seconds(org_id)
    avg_hours = round(avg_seconds / 3600, 1)
    
    # 2. Get Volume Trend
    trend_data = self.analytics_repo.get_volume_trend(org_id)
    formatted_trend = [
      schemas.VolumeTrendPoint(date=str(day), count=count) 
      for day, count in trend_data
    ]
    
    return schemas.AnalyticsResponse(
      mttr_hours=avg_hours,
      volume_trend=formatted_trend
    )