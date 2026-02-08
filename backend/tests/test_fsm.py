# backend/tests/test_fsm.py
from app.core.fsm import can_transition, IncidentStatus

def test_valid_transitions():
    # It should be allowed to go from DETECTED to INVESTIGATING, CLOSED or ESCALATED
    assert can_transition(IncidentStatus.DETECTED, IncidentStatus.INVESTIGATING) is True
    assert can_transition(IncidentStatus.DETECTED, IncidentStatus.CLOSED) is True
    assert can_transition(IncidentStatus.DETECTED, IncidentStatus.ESCALATED) is True
    
    # It should be allowed to go from INVESTIGATING to MITIGATED or ESCALATED
    assert can_transition(IncidentStatus.INVESTIGATING, IncidentStatus.MITIGATED) is True
    assert can_transition(IncidentStatus.INVESTIGATING, IncidentStatus.ESCALATED) is True
    
    # It should be allowed to go from MITIGATED to RESOLVED or INVESTIGATING
    assert can_transition(IncidentStatus.MITIGATED, IncidentStatus.RESOLVED) is True
    assert can_transition(IncidentStatus.MITIGATED, IncidentStatus.INVESTIGATING) is True
    
    # It should be allowed to go from RESOLVED to POSTMORTEM, CLOSED or MITIGATED
    assert can_transition(IncidentStatus.RESOLVED, IncidentStatus.POSTMORTEM) is True
    assert can_transition(IncidentStatus.RESOLVED, IncidentStatus.CLOSED) is True
    assert can_transition(IncidentStatus.RESOLVED, IncidentStatus.MITIGATED) is True
    
    # It should be allowed to go from POSTMORTEM to CLOSED
    assert can_transition(IncidentStatus.POSTMORTEM, IncidentStatus.CLOSED) is True
    
    # It should be allowed to go from ESCALATED to INVESTIGATING
    assert can_transition(IncidentStatus.ESCALATED, IncidentStatus.INVESTIGATING) is True
  
def test_invalid_transitions():
    # It should NOT be allowed to go from CLOSED to DETECTED
    assert can_transition(IncidentStatus.CLOSED, IncidentStatus.DETECTED) is False
    
    # It should NOT be allowed to go from ESCALATED to CLOSED
    assert can_transition(IncidentStatus.ESCALATED, IncidentStatus.CLOSED) is False
    
    # It should NOT be allowed to go from RESOLVED to DETECTED
    assert can_transition(IncidentStatus.RESOLVED, IncidentStatus.DETECTED) is False

def test_unknown_state():
    # Defensive programming check
    assert can_transition("ALIEN_STATE", IncidentStatus.DETECTED) is False
    
def test_same_state_transition():
    # Transitioning to the same state should be invalid
    assert can_transition(IncidentStatus.DETECTED, IncidentStatus.DETECTED) is False