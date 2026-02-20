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

  def get_volume_trend(self, org_id: UUID, days: int = 30):
    """
    Dynamic Chart History:
    Filters incidents created within the dynamic 'days' window and groups them by date.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # The query groups incidents by the date part of their created_at timestamp, counting how many were created each day.
    return self.db.query(
      func.date(models.Incident.created_at).label('date'),
      func.count(models.Incident.id)
    ).filter(
      models.Incident.created_at >= start_date,
      models.Incident.organization_id == org_id
    ).group_by('date').order_by('date').all()
    
  def calculate_mttr_seconds(self, org_id: UUID, days: int = 30) -> float:
    """"
    Mean Time to Resolve (MTTR) Calculation:
    Uses raw SQL to calculate the average time eposh difference between incident creation and resolution.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    mttr_query = text("""
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))
      FROM incidents
      WHERE resolved_at IS NOT NULL
      AND organization_id = :org_id
      AND created_at >= :start_date
    """)
    
    return self.db.execute(mttr_query, {"org_id": str(org_id), "start_date": start_date}).scalar() or 0
  
  def calculate_mtta_seconds(self, org_id: UUID, days: int = 30) -> float:
    """
    Mean Time to Acknowledge (MTTA) Calculation:
    Calculates the time difference between incident creation and the first acknowledgment event.
    Which is the epoch difference between the creation and *first* status change.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    mtta_query = text("""                
      WITH FirstResponse AS (
        SELECT incident_id, MIN(created_at) as ack_time
        FROM incident_events
        WHERE event_type IN ('STATUS_CHANGE', 'OWNER_CHANGE')
        GROUP BY incident_id 
      )
        
      SELECT AVG(EXTRACT(EPOCH FROM (fr.ack_time - i.created_at)))
      FROM incidents i
      JOIN FirstResponse fr ON i.id = fr.incident_id
      WHERE i.organization_id = :org_id
      AND i.created_at >= :start_date
    """)
    return self.db.execute(mtta_query, {"org_id": str(org_id), "start_date": start_date}).scalar() or 0.0
  
  def calculate_sla_breach_rate(self, org_id: UUID, days: int = 30):
    """
    SLA Breach Rate Calculation:
    Determines the percentage of incidents that breached their SLA based on their severity.
    """
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # The query counts total incidents and those that had an SLA_BREACH event.
    breach_query = text("""
      SELECT
        COUNT(DISTINCT i.id) as total_incidents,
        COUNT(DISTINCT CASE WHEN ie.event_type = 'SLA_BREACH' THEN i.id END) as breached_incidents
      FROM incidents i
      LEFT JOIN incident_events ie ON i.id = ie.incident_id
      WHERE i.organization_id = :org_id
      AND i.created_at >= :start_date  
    """)
    
    result = self.db.execute(breach_query, {"org_id": str(org_id), "start_date": start_date}).fetchone()
    
    total = result.total_incidents or 0
    breached = result.breached_incidents or 0
    breach_rate = (breached / total * 100) if total > 0 else 0.0
    return {"total": total, "breached": breached, "breach_rate": round(breach_rate, 2)}
  
  
  def get_detailed_user_stats(self, org_id: UUID):
    """
    Individual User Performance Metrics:
    Aggregates data across incidents and audit logs to build a perfomance profile for each user.
    """
    query = text("""
      SELECT
        u.id, u.full_name, u.email, u.role,
        COUNT(DISTINCT i.id) as assigned_incidents,
        COUNT(DISTINCT CASE WHEN i.status = 'RESOLVED' THEN i.id END) as resolved_incidents,
        COUNT(DISTINCT CASE WHEN ie.event_type = 'COMMENT' THEN i.id END) as comments_made, 
        COUNT(DISTINCT CASE WHEN ie.event_type = 'SLA_BREACH' THEN i.id END) as breached_incidents,
        COUNT(DISTINCT CASE WHEN ie.event_type = 'STATUS_CHANGE' AND ie.new_value = 'ESCALATED' THEN i.id END) as escalations_triggered
      FROM users u
      LEFT JOIN incidents i ON u.id = i.owner_id
      LEFT JOIN incident_events ie ON u.id = ie.actor_id
      WHERE u.organization_id = :org_id
      AND u.role != 'BOT'
      GROUP BY u.id, u.full_name, u.email, u.role
    """)
    return self.db.execute(query, {"org_id": str(org_id)}).fetchall()
  
    