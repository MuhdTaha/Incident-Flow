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
    raw_users = self.analytics_repo.get_detailed_user_stats(org_id)
    formatted_users = [
      schemas.DetailedUserStats(
        id=row.id,
        full_name=row.full_name,
        email=row.email,
        role=row.role,
        assigned_count=row.assigned_incidents,
        resolved_count=row.resolved_incidents,
        comments_made=row.comments_made,
        breached_incidents=row.breached_incidents,
        escalations_triggered=row.escalations_triggered   
      ) for row in raw_users
    ]
        
    return schemas.AdminDashboardStats(
      total_users=total_users,
      total_incidents=total_incidents,
      active_incidents=active_incidents,
      incidents_by_severity=sev_dict,
      user_performance=formatted_users
    )

  def get_analytics_charts(self, org_id: UUID, days: int = 30) -> schemas.AnalyticsResponse:
    # 1. Dynamic Time Window Calculations
    mttr_sec = self.analytics_repo.calculate_mttr_seconds(org_id, days)
    mtta_sec = self.analytics_repo.calculate_mtta_seconds(org_id, days)
    sla_data = self.analytics_repo.calculate_sla_breach_rate(org_id, days)
    
    # 2. Get Volume Trend
    trend_data = self.analytics_repo.get_volume_trend(org_id, days)
    formatted_trend = [
      schemas.VolumeTrendPoint(date=str(day), count=count) 
      for day, count in trend_data
    ]
    
    return schemas.AnalyticsResponse(
      time_window_days=days,
      mttr_hours=round(mttr_sec / 3600, 2), # Convert seconds to hours
      mtta_minutes=round(mtta_sec / 60, 2),  # Convert seconds to minutes
      sla_breach_rate=sla_data['breach_rate'],
      total_breaches=sla_data['breached'],
      volume_trend=formatted_trend
    )