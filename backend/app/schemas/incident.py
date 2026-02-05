from pydantic import BaseModel, computed_field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.core.fsm import IncidentStatus, VALID_TRANSITIONS
from app.models import IncidentSeverity

class IncidentCreate(BaseModel):
  title: str
  description: str
  severity: IncidentSeverity
  owner_id: Optional[UUID] = None

class IncidentRead(BaseModel):
  id: UUID
  title: str
  description: str
  severity: str
  status: str
  owner_id: Optional[UUID]
  updated_at: datetime
  
  @computed_field
  @property
  def allowed_transitions(self) -> List[str]:
    return VALID_TRANSITIONS.get(IncidentStatus(self.status), [])
  
  class Config:
    from_attributes = True

class TransitionRequest(BaseModel):
  new_state: IncidentStatus
  comment: Optional[str] = None

class CommentRequest(BaseModel):
  comment: str
    
class IncidentUpdate(BaseModel):
  severity: Optional[str] = None
  owner_id: Optional[str] = None
  comment: Optional[str] = None