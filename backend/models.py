# backend/models.py
from datetime import datetime
from os import name
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

class Organization(Base):
  __tablename__ = "organizations"
  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  name = Column(String, unique=True)
  slug = Column(String, unique=True, index=True) # e.g., "acme-corp"
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  
  # Relationships
  users = relationship("User", back_populates="organization")
  incidents = relationship("Incident", back_populates="organization")

class User(Base):
  __tablename__ = "users"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  email = Column(String, unique=True, nullable=False)
  full_name = Column(String, nullable=False)
  role = Column(SQLEnum(UserRole, name="user_role"), default=UserRole.ENGINEER, nullable=False)
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  phone_number = Column(String, nullable=True)
  organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

  # Relationships
  incidents = relationship("Incident", back_populates="owner")
  actions = relationship("IncidentEvent", back_populates="actor")
  organization = relationship("Organization", back_populates="users")

class Incident(Base):
  __tablename__ = "incidents"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  title = Column(String, nullable=False)
  description = Column(Text)
  severity = Column(SQLEnum(IncidentSeverity, name="incident_severity"), nullable=False)
  status = Column(SQLEnum(IncidentStatus, name="incident_status"), default=IncidentStatus.DETECTED, nullable=False)
  owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
  resolved_at = Column(DateTime(timezone=True), nullable=True)
  organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

  # Relationships
  owner = relationship("User", back_populates="incidents")
  events = relationship("IncidentEvent", back_populates="incident", order_by="desc(IncidentEvent.created_at)", cascade="all, delete-orphan")
  attachments = relationship("IncidentAttachment", back_populates="incident", cascade="all, delete-orphan")
  organization = relationship("Organization", back_populates="incidents")


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
  organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

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
  organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
  
  # Relationships
  incident = relationship("Incident", back_populates="attachments")