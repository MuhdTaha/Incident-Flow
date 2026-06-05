from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from typing import List, Optional
from app.db.models import User, Incident, IncidentEvent, Organization, UserRole

class UserRepository:
  def __init__(self, db: Session):
    self.db = db

  def get_org(self, org_id: UUID) -> Optional[Organization]:
    return self.db.query(Organization).filter(Organization.id == org_id).first()

  def get_by_id(self, user_id: UUID, org_id: UUID) -> Optional[User]:
    return self.db.query(User).filter(
      User.id == user_id,
      User.organization_id == org_id
    ).first()

  def get_by_id_global(self, user_id: UUID) -> Optional[User]:
    return self.db.query(User).filter(User.id == user_id).first()

  def list_all(self, org_id: UUID) -> List[User]:
    return self.db.query(User).filter(
      User.organization_id == org_id,
      User.role != UserRole.BOT
    ).all()

  def add(self, user: User) -> User:
    self.db.add(user)
    self.db.flush()
    self.db.refresh(user)
    return user

  def flush(self):
    self.db.flush()

  def refresh(self, user: User) -> User:
    self.db.refresh(user)
    return user

  def delete_entity(self, user: User):
    self.db.query(Incident).filter(Incident.owner_id == user.id).update({Incident.owner_id: None})
    self.db.query(IncidentEvent).filter(IncidentEvent.actor_id == user.id).update({IncidentEvent.actor_id: None})
    self.db.delete(user)

  def get_user_stats(self, org_id: UUID):
    return self.db.query(
      User,
      func.count(Incident.id).label("incident_count")
    ).filter(
      User.role != UserRole.BOT,
      User.organization_id == org_id
    ).outerjoin(
      Incident,
      User.id == Incident.owner_id
    ).group_by(User.id).all()
