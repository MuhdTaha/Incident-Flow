from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from typing import List, Optional
from app.models import User, Incident, IncidentEvent, Organization

class UserRepository:
  def __init__(self, db: Session):
    self.db = db
      
  def get_org(self, org_id: UUID) -> List[User]:
    return self.db.query(Organization).filter(Organization.id == org_id).first()

  def get_by_id(self, user_id: UUID, org_id: UUID) -> Optional[User]:
    return self.db.query(User).filter(
      User.id == user_id,
      User.organization_id == org_id
    ).first()
  
  # Used for auth (no org_id check initially, as we don't know the org yet)
  def get_by_id_global(self, user_id: UUID) -> Optional[User]:
    return self.db.query(User).filter(User.id == user_id).first()

  def list_all(self, org_id: UUID) -> List[User]:
    return self.db.query(User).filter(
      User.organization_id == org_id,
      User.role != "BOT"
    ).all()

  def update(self, user: User) -> User:
    self.db.add(user)
    self.db.commit()
    self.db.refresh(user)
    return user

  def delete(self, user: User):
    # Nullify relationships first
    self.db.query(Incident).filter(Incident.owner_id == user.id).update({Incident.owner_id: None})
    self.db.query(IncidentEvent).filter(IncidentEvent.actor_id == user.id).update({IncidentEvent.actor_id: None})
    
    self.db.delete(user)
    self.db.commit()

  def get_user_stats(self, org_id: UUID):
    """
    Complex query for Admin Dashboard: Users + Count of Incidents they own
    """
    return self.db.query(
      User,
      func.count(Incident.id).label("incident_count")
    ).filter(
      User.role != "BOT", 
      User.organization_id == org_id
    ).outerjoin(
      Incident, 
      User.id == Incident.owner_id
    ).group_by(User.id).all()