# backend/app/core/fsm.py

from enum import Enum

# Define incident statuses
class IncidentStatus(str, Enum):
  DETECTED = "DETECTED"
  INVESTIGATING = "INVESTIGATING"
  MITIGATED = "MITIGATED"
  RESOLVED = "RESOLVED"
  POSTMORTEM = "POSTMORTEM"
  CLOSED = "CLOSED"
  ESCALATED = "ESCALATED"

# Valid transitions map
VALID_TRANSITIONS = {
  IncidentStatus.DETECTED: [IncidentStatus.INVESTIGATING, IncidentStatus.CLOSED, IncidentStatus.ESCALATED],
  IncidentStatus.INVESTIGATING: [IncidentStatus.MITIGATED, IncidentStatus.ESCALATED],
  IncidentStatus.MITIGATED: [IncidentStatus.RESOLVED, IncidentStatus.INVESTIGATING], # Regression possible
  IncidentStatus.RESOLVED: [IncidentStatus.POSTMORTEM, IncidentStatus.CLOSED, IncidentStatus.MITIGATED],
  IncidentStatus.POSTMORTEM: [IncidentStatus.CLOSED],
  IncidentStatus.CLOSED: [], # Terminal state
  IncidentStatus.ESCALATED: [IncidentStatus.INVESTIGATING] # Re-assignment after escalation
}

def can_transition(current_state: IncidentStatus, new_state: IncidentStatus) -> bool:
  # Check if the transition is valid, return True if valid, else False
  return new_state in VALID_TRANSITIONS.get(current_state, [])