"""
Idempotent demo incident/event seeding for portfolio demos.

- seed(): ensure a catalog of realistic incidents + audit timelines exist
- refresh(): append fresh comments / progress open demos so the UI stays alive
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.constants import (
  DEFAULT_ORG_ID,
  SYSTEM_BOT_EMAIL,
  SYSTEM_BOT_ID,
  SYSTEM_BOT_NAME,
)
from app.core.fsm import VALID_TRANSITIONS, IncidentStatus, can_transition
from app.db import models


# Marker stored on CREATION events so refresh only mutates demo-owned rows
DEMO_MARKER = "demo-seed:v1"

DEMO_USER_SPECS = (
  {
    "id": UUID("00000000-0000-0000-0000-0000000000a1"),
    "email": "alex.admin@company.com",
    "full_name": "Alex Rivera",
    "role": models.UserRole.ADMIN,
  },
  {
    "id": UUID("00000000-0000-0000-0000-0000000000a2"),
    "email": "sarah.ops@company.com",
    "full_name": "Sarah Chen",
    "role": models.UserRole.MANAGER,
  },
  {
    "id": UUID("00000000-0000-0000-0000-0000000000a3"),
    "email": "jordan.dev@company.com",
    "full_name": "Jordan Smyth",
    "role": models.UserRole.ENGINEER,
  },
)

COMMENT_POOL = (
  "Checking dashboards and recent deploys.",
  "Correlated spike with the last canary release.",
  "Paging on-call — sharing a Zoom bridge shortly.",
  "Mitigation applied; watching error rates for 15 minutes.",
  "Root cause candidate identified in the auth middleware.",
  "Customer impact looks limited to us-east-1.",
  "Rollback complete. Latency returning to baseline.",
  "Added a temporary feature flag while we patch.",
  "Confirmed via logs — not a false positive.",
  "Posting an update in #incidents.",
)

STATUS_COMMENT = {
  IncidentStatus.INVESTIGATING: "Starting investigation.",
  IncidentStatus.MITIGATED: "Impact contained; monitoring.",
  IncidentStatus.RESOLVED: "Service restored. Preparing notes.",
  IncidentStatus.POSTMORTEM: "Drafting post-mortem from the audit log.",
  IncidentStatus.CLOSED: "Incident closed after review.",
  IncidentStatus.ESCALATED: "Escalating — SLA pressure / customer impact.",
}


@dataclass
class TimelineStep:
  event_type: str
  old_value: Optional[str] = None
  new_value: Optional[str] = None
  comment: Optional[str] = None
  actor: str = "jordan"  # alex | sarah | jordan | bot
  hours_ago: float = 1.0


@dataclass
class DemoIncidentSpec:
  title: str
  description: str
  severity: models.IncidentSeverity
  status: IncidentStatus
  owner: str = "jordan"
  timeline: List[TimelineStep] = field(default_factory=list)


DEMO_CATALOG: Tuple[DemoIncidentSpec, ...] = (
  DemoIncidentSpec(
    title="Main API Gateway Timeout",
    description="Latency spikes across all regions. Users reporting 504 Gateway Timeouts.",
    severity=models.IncidentSeverity.SEV1,
    status=IncidentStatus.INVESTIGATING,
    owner="jordan",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="System monitoring triggered an alert.", actor="bot", hours_ago=6),
      TimelineStep("OWNER_CHANGE", old_value=None, new_value="jordan", comment="Assigning to Jordan for triage.", actor="sarah", hours_ago=5.5),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Looking into the load balancer logs now.", actor="jordan", hours_ago=5),
      TimelineStep("COMMENT", comment="Identified a memory leak in the auth-middleware container.", actor="jordan", hours_ago=3),
    ],
  ),
  DemoIncidentSpec(
    title="Database Connection Pool Exhaustion",
    description="API pods failing to acquire DB connections. Checkout and search degraded.",
    severity=models.IncidentSeverity.SEV1,
    status=IncidentStatus.RESOLVED,
    owner="jordan",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="PgBouncer saturation alert fired.", actor="bot", hours_ago=30),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Looking into the DB logs now.", actor="jordan", hours_ago=29),
      TimelineStep("COMMENT", comment="Found a rogue query doing full table scans. Killing it.", actor="jordan", hours_ago=28),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="MITIGATED", comment="Query killed and index added. Pools recovering.", actor="jordan", hours_ago=27),
      TimelineStep("STATUS_CHANGE", old_value="MITIGATED", new_value="RESOLVED", comment="Connection wait time back under SLO.", actor="sarah", hours_ago=26),
    ],
  ),
  DemoIncidentSpec(
    title="Third-party API Rate Limit Reached",
    description="Salesforce sync jobs failing with HTTP 429. CRM updates delayed.",
    severity=models.IncidentSeverity.SEV2,
    status=IncidentStatus.RESOLVED,
    owner="sarah",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Sync worker error rate crossed threshold.", actor="bot", hours_ago=48),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="I see the errors. Checking Salesforce quotas.", actor="sarah", hours_ago=47),
      TimelineStep("SLA_BREACH", old_value="INVESTIGATING", new_value="ESCALATED", comment="Auto-escalated: SEV2 SLA of 2 hours breached.", actor="bot", hours_ago=45),
      TimelineStep("STATUS_CHANGE", old_value="ESCALATED", new_value="INVESTIGATING", comment="Requested emergency quota increase from Salesforce support.", actor="alex", hours_ago=44),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="MITIGATED", comment="Quota increased. Sync is flowing again.", actor="sarah", hours_ago=42),
      TimelineStep("STATUS_CHANGE", old_value="MITIGATED", new_value="RESOLVED", comment="Backfill complete.", actor="sarah", hours_ago=40),
    ],
  ),
  DemoIncidentSpec(
    title="Missing Avatars in S3",
    description="Profile images returning 404. Suspected bucket policy / Terraform drift.",
    severity=models.IncidentSeverity.SEV2,
    status=IncidentStatus.INVESTIGATING,
    owner="jordan",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="CDN 404 rate elevated for /avatars/*.", actor="bot", hours_ago=8),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="I see the 404s. Looking into bucket policies.", actor="jordan", hours_ago=7),
      TimelineStep("COMMENT", comment="Looks like a Terraform drift issue. Planning a rollback.", actor="jordan", hours_ago=4),
    ],
  ),
  DemoIncidentSpec(
    title="SSL Certificate Expiry Warning",
    description="api.incidentflow.example cert expires within 7 days.",
    severity=models.IncidentSeverity.SEV3,
    status=IncidentStatus.CLOSED,
    owner="alex",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Cert expiry monitor warning.", actor="bot", hours_ago=72),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Renewing via Let's Encrypt now.", actor="alex", hours_ago=71),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="RESOLVED", comment="Cert renewed and verified.", actor="alex", hours_ago=70),
      TimelineStep("STATUS_CHANGE", old_value="RESOLVED", new_value="CLOSED", comment="No further action required.", actor="alex", hours_ago=69),
    ],
  ),
  DemoIncidentSpec(
    title="Slow Dashboard Load",
    description="Admin metrics page p95 latency > 8s. Suspected N+1 query.",
    severity=models.IncidentSeverity.SEV3,
    status=IncidentStatus.ESCALATED,
    owner="jordan",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="RUM reported slow loads on /admin.", actor="bot", hours_ago=10),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Profiling the analytics endpoints.", actor="jordan", hours_ago=9),
      TimelineStep("SLA_BREACH", old_value="INVESTIGATING", new_value="ESCALATED", comment="Auto-escalated due to inactivity.", actor="bot", hours_ago=5),
    ],
  ),
  DemoIncidentSpec(
    title="Intermittent Auth Delays",
    description="Login latency spikes correlated with Redis session store restarts.",
    severity=models.IncidentSeverity.SEV3,
    status=IncidentStatus.RESOLVED,
    owner="sarah",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Auth p99 crossed 2s.", actor="bot", hours_ago=36),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Checking the Redis session store.", actor="sarah", hours_ago=35),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="MITIGATED", comment="Restarted the auth pods. Latency is back to normal.", actor="sarah", hours_ago=34),
      TimelineStep("STATUS_CHANGE", old_value="MITIGATED", new_value="RESOLVED", comment="No recurrence after 1 hour.", actor="alex", hours_ago=33),
    ],
  ),
  DemoIncidentSpec(
    title="Internal Dashboard CSS Glitch",
    description="CSS files failing to load on the internal metrics dashboard.",
    severity=models.IncidentSeverity.SEV3,
    status=IncidentStatus.RESOLVED,
    owner="sarah",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Reported by internal tooling users.", actor="bot", hours_ago=96),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="CDN cache miss for main.css.", actor="sarah", hours_ago=95),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="RESOLVED", comment="Purged CDN cache; assets loading.", actor="sarah", hours_ago=94),
    ],
  ),
  DemoIncidentSpec(
    title="High CPU on Worker Nodes",
    description="Celery workers pegged at 95% CPU. SLA checks delayed.",
    severity=models.IncidentSeverity.SEV2,
    status=IncidentStatus.INVESTIGATING,
    owner="jordan",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Node CPU saturation alert.", actor="bot", hours_ago=4),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Sampling flame graphs on worker-3.", actor="jordan", hours_ago=3),
      TimelineStep("COMMENT", comment="Hot path looks like a tight loop in the SLA scanner.", actor="jordan", hours_ago=1),
    ],
  ),
  DemoIncidentSpec(
    title="Payment Gateway Timeout",
    description="Stripe charge API timeouts during peak traffic.",
    severity=models.IncidentSeverity.SEV1,
    status=IncidentStatus.RESOLVED,
    owner="alex",
    timeline=[
      TimelineStep("CREATION", new_value="DETECTED", comment="Checkout error budget burn alert.", actor="bot", hours_ago=60),
      TimelineStep("STATUS_CHANGE", old_value="DETECTED", new_value="INVESTIGATING", comment="Checking Stripe status + our retry policy.", actor="alex", hours_ago=59),
      TimelineStep("STATUS_CHANGE", old_value="INVESTIGATING", new_value="MITIGATED", comment="Increased timeout + circuit breaker.", actor="alex", hours_ago=58),
      TimelineStep("STATUS_CHANGE", old_value="MITIGATED", new_value="RESOLVED", comment="Stripe recovered; metrics healthy.", actor="alex", hours_ago=56),
    ],
  ),
)


def resolve_org_id() -> UUID:
  raw = os.getenv("DEMO_ORG_ID")
  if raw:
    return UUID(raw)
  return DEFAULT_ORG_ID


class DemoSeedService:
  def __init__(self, db: Session, org_id: Optional[UUID] = None):
    self.db = db
    self.org_id = org_id or resolve_org_id()
    self._actors: dict[str, models.User] = {}

  # --- public API ---

  def seed(self) -> dict:
    """Ensure demo users + catalog incidents/timelines exist. Idempotent."""
    self._ensure_org()
    self._ensure_users()
    created = 0
    skipped = 0
    for spec in DEMO_CATALOG:
      incident, was_created = self._ensure_incident(spec)
      if was_created:
        created += 1
      else:
        skipped += 1
      self._ensure_timeline(incident, spec)
    self.db.commit()
    return {
      "org_id": str(self.org_id),
      "incidents_created": created,
      "incidents_existing": skipped,
      "catalog_size": len(DEMO_CATALOG),
    }

  def refresh(self, actions: int = 3) -> dict:
    """
    Append fresh audit activity so demos look live.
    Always runs seed() first so a cold deployed DB gets populated.
    """
    seed_result = self.seed()
    self._ensure_users()

    demo_incidents = self._demo_incidents()
    if not demo_incidents:
      return {**seed_result, "actions": [], "message": "No demo incidents found after seed"}

    performed: List[str] = []
    open_ones = [
      i for i in demo_incidents
      if i.status not in (IncidentStatus.CLOSED, IncidentStatus.POSTMORTEM)
    ]
    targets = open_ones or demo_incidents

    for _ in range(max(1, actions)):
      incident = random.choice(targets)
      # Prefer progressing status ~40% of the time when a transition exists
      next_states = VALID_TRANSITIONS.get(IncidentStatus(incident.status), [])
      if next_states and random.random() < 0.4:
        new_state = random.choice(next_states)
        action = self._transition(incident, new_state)
      else:
        action = self._add_comment(incident)
      performed.append(action)
      # Keep targets fresh after mutations
      if incident.status in (IncidentStatus.CLOSED, IncidentStatus.POSTMORTEM):
        targets = [i for i in targets if i.id != incident.id] or demo_incidents

    # Occasionally open a brand-new "live" demo incident so the dashboard churns
    if random.random() < 0.35:
      performed.append(self._spawn_live_incident())

    self.db.commit()
    return {**seed_result, "actions": performed, "action_count": len(performed)}

  # --- internals ---

  def _ensure_org(self) -> models.Organization:
    org = self.db.query(models.Organization).filter(models.Organization.id == self.org_id).first()
    if org:
      return org
    org = models.Organization(
      id=self.org_id,
      name="Default Org",
      slug="default-org",
    )
    self.db.add(org)
    self.db.flush()
    return org

  def _ensure_users(self) -> None:
    bot = self.db.query(models.User).filter(models.User.id == SYSTEM_BOT_ID).first()
    if not bot:
      bot = self.db.query(models.User).filter(models.User.email == SYSTEM_BOT_EMAIL).first()
    if not bot:
      bot = models.User(
        id=SYSTEM_BOT_ID,
        email=SYSTEM_BOT_EMAIL,
        full_name=SYSTEM_BOT_NAME,
        role=models.UserRole.BOT,
        organization_id=self.org_id,
      )
      self.db.add(bot)
      self.db.flush()
    self._actors["bot"] = bot

    for spec in DEMO_USER_SPECS:
      user = self.db.query(models.User).filter(models.User.email == spec["email"]).first()
      if not user:
        user = models.User(
          id=spec["id"],
          email=spec["email"],
          full_name=spec["full_name"],
          role=spec["role"],
          organization_id=self.org_id,
        )
        self.db.add(user)
        self.db.flush()
      elif user.organization_id != self.org_id:
        # Keep personas in the demo org so they can own incidents there
        user.organization_id = self.org_id
      key = spec["email"].split("@")[0].split(".")[0]  # alex | sarah | jordan
      self._actors[key] = user

    self.db.flush()

  def _actor(self, key: str) -> models.User:
    if key not in self._actors:
      self._ensure_users()
    return self._actors.get(key) or self._actors["bot"]

  def _ensure_incident(self, spec: DemoIncidentSpec) -> Tuple[models.Incident, bool]:
    existing = (
      self.db.query(models.Incident)
      .filter(
        models.Incident.organization_id == self.org_id,
        models.Incident.title == spec.title,
      )
      .first()
    )
    if existing:
      return existing, False

    owner = self._actor(spec.owner)
    incident = models.Incident(
      id=uuid4(),
      title=spec.title,
      description=spec.description,
      severity=spec.severity,
      status=spec.status,
      owner_id=owner.id,
      organization_id=self.org_id,
      created_at=datetime.now(timezone.utc) - timedelta(hours=max(s.hours_ago for s in spec.timeline) if spec.timeline else 1),
    )
    if spec.status in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED, IncidentStatus.POSTMORTEM):
      incident.resolved_at = datetime.now(timezone.utc) - timedelta(hours=1)
    self.db.add(incident)
    self.db.flush()
    return incident, True

  def _ensure_timeline(self, incident: models.Incident, spec: DemoIncidentSpec) -> None:
    existing = (
      self.db.query(models.IncidentEvent)
      .filter(
        models.IncidentEvent.incident_id == incident.id,
        models.IncidentEvent.organization_id == self.org_id,
      )
      .count()
    )
    if existing > 0:
      # Still stamp a CREATION marker if somehow missing so refresh can find demos
      has_marker = (
        self.db.query(models.IncidentEvent)
        .filter(
          models.IncidentEvent.incident_id == incident.id,
          models.IncidentEvent.comment.contains(DEMO_MARKER),
        )
        .first()
      )
      if not has_marker and existing > 0:
        # Tag silently via a no-op comment only when this is a known catalog title
        pass
      return

    now = datetime.now(timezone.utc)
    for step in sorted(spec.timeline, key=lambda s: -s.hours_ago):
      actor = self._actor(step.actor)
      old_val, new_val = step.old_value, step.new_value
      if step.event_type == "OWNER_CHANGE":
        # Resolve persona keys to real user ids for display consistency
        if old_val in self._actors:
          old_val = str(self._actors[old_val].id)
        if new_val in self._actors:
          new_val = str(self._actors[new_val].id)

      comment = step.comment or ""
      if step.event_type == "CREATION" and DEMO_MARKER not in comment:
        comment = f"{comment} [{DEMO_MARKER}]".strip()

      event = models.IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        actor_id=None if step.actor == "bot" else actor.id,
        event_type=step.event_type,
        old_value=old_val,
        new_value=new_val,
        comment=comment,
        organization_id=self.org_id,
        created_at=now - timedelta(hours=step.hours_ago),
      )
      # System bot as actor for bot steps (UI shows System Bot when actor missing OR bot)
      if step.actor == "bot":
        event.actor_id = self._actor("bot").id

      self.db.add(event)
    self.db.flush()

  def _demo_incidents(self) -> List[models.Incident]:
    titles = [s.title for s in DEMO_CATALOG]
    catalog = (
      self.db.query(models.Incident)
      .filter(
        models.Incident.organization_id == self.org_id,
        models.Incident.title.in_(titles),
      )
      .all()
    )
    live = (
      self.db.query(models.Incident)
      .filter(
        models.Incident.organization_id == self.org_id,
        models.Incident.title.like("Live Demo:%"),
      )
      .all()
    )
    return catalog + live

  def _add_comment(self, incident: models.Incident) -> str:
    actor = random.choice([self._actor("jordan"), self._actor("sarah"), self._actor("alex")])
    text = random.choice(COMMENT_POOL)
    self.db.add(
      models.IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        actor_id=actor.id,
        event_type="COMMENT",
        comment=f"{text} [{DEMO_MARKER}]",
        organization_id=self.org_id,
        created_at=datetime.now(timezone.utc),
      )
    )
    incident.updated_at = datetime.now(timezone.utc)
    self.db.flush()
    return f"comment:{incident.title[:40]}"

  def _transition(self, incident: models.Incident, new_state: IncidentStatus) -> str:
    old = IncidentStatus(incident.status)
    if not can_transition(old, new_state):
      return self._add_comment(incident)

    actor = random.choice([self._actor("jordan"), self._actor("sarah"), self._actor("alex")])
    incident.status = new_state
    if new_state in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED) and not incident.resolved_at:
      incident.resolved_at = datetime.now(timezone.utc)
    elif new_state == IncidentStatus.INVESTIGATING:
      incident.resolved_at = None
    incident.updated_at = datetime.now(timezone.utc)

    self.db.add(
      models.IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        actor_id=actor.id,
        event_type="STATUS_CHANGE",
        old_value=old.value,
        new_value=new_state.value,
        comment=f"{STATUS_COMMENT.get(new_state, f'Transitioned to {new_state.value}')} [{DEMO_MARKER}]",
        organization_id=self.org_id,
        created_at=datetime.now(timezone.utc),
      )
    )
    self.db.flush()
    return f"transition:{incident.title[:32]}:{old.value}->{new_state.value}"

  def _spawn_live_incident(self) -> str:
    """Create a short-lived active incident so the dashboard always has recent activity."""
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = f"Live Demo: Synthetic probe anomaly ({stamp})"
    owner = self._actor("jordan")
    incident = models.Incident(
      id=uuid4(),
      title=title,
      description="Auto-generated demo incident to keep the portfolio dashboard fresh.",
      severity=random.choice(
        [models.IncidentSeverity.SEV2, models.IncidentSeverity.SEV3, models.IncidentSeverity.SEV4]
      ),
      status=IncidentStatus.DETECTED,
      owner_id=owner.id,
      organization_id=self.org_id,
    )
    self.db.add(incident)
    self.db.flush()
    self.db.add(
      models.IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        actor_id=self._actor("bot").id,
        event_type="CREATION",
        new_value=IncidentStatus.DETECTED.value,
        comment=f"Synthetic monitor alert. [{DEMO_MARKER}]",
        organization_id=self.org_id,
      )
    )
    # Immediately move to INVESTIGATING so it looks in-progress
    incident.status = IncidentStatus.INVESTIGATING
    self.db.add(
      models.IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        actor_id=owner.id,
        event_type="STATUS_CHANGE",
        old_value=IncidentStatus.DETECTED.value,
        new_value=IncidentStatus.INVESTIGATING.value,
        comment=f"Acknowledged — digging into probe failures. [{DEMO_MARKER}]",
        organization_id=self.org_id,
      )
    )
    self.db.flush()
    self._prune_old_live_incidents(keep=5)
    return f"spawn:{title}"

  def _prune_old_live_incidents(self, keep: int = 5) -> None:
    live = (
      self.db.query(models.Incident)
      .filter(
        models.Incident.organization_id == self.org_id,
        models.Incident.title.like("Live Demo:%"),
      )
      .order_by(models.Incident.created_at.desc())
      .all()
    )
    for incident in live[keep:]:
      self.db.delete(incident)
    self.db.flush()


def run_seed(org_id: Optional[UUID] = None) -> dict:
  from app.db.session import SessionLocal

  db = SessionLocal()
  try:
    return DemoSeedService(db, org_id=org_id).seed()
  finally:
    db.close()


def run_refresh(org_id: Optional[UUID] = None, actions: int = 3) -> dict:
  from app.db.session import SessionLocal

  db = SessionLocal()
  try:
    return DemoSeedService(db, org_id=org_id).refresh(actions=actions)
  finally:
    db.close()
