# backend/models.py
import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, UUID, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

# --- Enums ---
class IncidentSeverity(str, enum.Enum):
  SEV1 = "SEV1"
  SEV2 = "SEV2"
  SEV3 = "SEV3"
  SEV4 = "SEV4"

class IncidentStatus(str, enum.Enum):
  DETECTED = "DETECTED"
  INVESTIGATING = "INVESTIGATING"
  MITIGATED = "MITIGATED"
  RESOLVED = "RESOLVED"
  POSTMORTEM = "POSTMORTEM"
  CLOSED = "CLOSED"
  ESCALATED = "ESCALATED"

class UserRole(str, enum.Enum):
  ENGINEER = "ENGINEER"
  MANAGER = "MANAGER"
  ADMIN = "ADMIN"
  BOT = "BOT"


# --- Models ---

class User(Base):
  __tablename__ = "users"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  email = Column(String, unique=True, nullable=False)
  full_name = Column(String, nullable=False)
  role = Column(SQLEnum(UserRole), default=UserRole.ENGINEER, nullable=False)
  created_at = Column(DateTime(timezone=True), server_default=func.now())

  # Relationships
  incidents = relationship("Incident", back_populates="owner")
  actions = relationship("IncidentEvent", back_populates="actor")

class Incident(Base):
  __tablename__ = "incidents"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  title = Column(String, nullable=False)
  description = Column(Text)
  severity = Column(SQLEnum(IncidentSeverity), nullable=False)
  status = Column(SQLEnum(IncidentStatus), default=IncidentStatus.DETECTED, nullable=False)
  owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
  resolved_at = Column(DateTime(timezone=True), nullable=True)

  # Relationships
  owner = relationship("User", back_populates="incidents")
  events = relationship("IncidentEvent", back_populates="incident", order_by="desc(IncidentEvent.created_at)", cascade="all, delete-orphan")
  attachments = relationship("IncidentAttachment", back_populates="incident", cascade="all, delete-orphan")

class IncidentEvent(Base):
  """
  Immutable Audit Log. 
  Every state change, assignment, or comment creates a row here.
  """
  __tablename__ = "incident_events"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
  actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Nullable for system events
  event_type = Column(String, nullable=False) # e.g., 'STATUS_CHANGE', 'COMMENT'
  old_value = Column(String)
  new_value = Column(String)
  comment = Column(Text)
  created_at = Column(DateTime(timezone=True), server_default=func.now())

  # Relationships
  incident = relationship("Incident", back_populates="events")
  actor = relationship("User", back_populates="actions")

class IncidentAttachment(Base):
  __tablename__ = "incident_attachments"
  
  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
  file_name = Column(String, nullable=False)
  file_key = Column(String, unique=True, nullable=False) # S3/MinIO object path
  uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  
  # Relationships
  incident = relationship("Incident", back_populates="attachments")