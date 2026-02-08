from sqlalchemy.orm import Session
from sqlalchemy import func, text
from uuid import UUID
from datetime import datetime, timedelta
import app.db.models as models

class AnalyticsRepository:
  def __init__(self, db: Session):
    self.db = db

  def get_total_users(self, org_id: UUID) -> int:
    return self.db.query(models.User).filter(
      models.User.role != "BOT", 
      models.User.organization_id == org_id
    ).count()

  def get_total_incidents(self, org_id: UUID) -> int:
    return self.db.query(models.Incident).filter(
      models.Incident.organization_id == org_id
    ).count()

  def get_active_incidents(self, org_id: UUID) -> int:
    return self.db.query(models.Incident).filter(
      models.Incident.status != models.IncidentStatus.CLOSED, 
      models.Incident.organization_id == org_id
    ).count()

  def get_severity_counts(self, org_id: UUID):
    return self.db.query(
      models.Incident.severity, 
      func.count(models.Incident.id)
    ).filter(
      models.Incident.organization_id == org_id
    ).group_by(models.Incident.severity).all()

  def calculate_mttr_seconds(self, org_id: UUID) -> float:
    mttr_query = text("""
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) 
      FROM incidents 
      WHERE resolved_at IS NOT NULL
      AND organization_id = :org_id
    """)
    return self.db.execute(mttr_query, {"org_id": org_id}).scalar() or 0

  def get_volume_trend(self, org_id: UUID, days=7):
    start_date = datetime.utcnow() - timedelta(days=days)
    return self.db.query(
      func.date(models.Incident.created_at).label('date'),
      func.count(models.Incident.id)
    ).filter(
      models.Incident.created_at >= start_date, 
      models.Incident.organization_id == org_id
    ).group_by('date').order_by('date').all()