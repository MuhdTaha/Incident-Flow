# Product Requirements Document (PRD)

**Product:** IncidentFlow  
**Version:** 1.0  
**Status:** Shipped (capstone / portfolio)  
**Author:** Muhammad Taha

---

## 1. Problem

Engineering teams need a single place to declare, track, and learn from production incidents. Spreadsheets and chat threads lack:

- Enforced lifecycle states (who is doing what, and when)
- A tamper-evident audit trail for post-mortems
- Role-appropriate access across a team
- Isolation between companies on a shared platform

## 2. Product vision

IncidentFlow is a **multi-tenant SaaS incident management tool** for small-to-mid engineering orgs. Users declare incidents, move them through a defined workflow, attach evidence, and generate post-mortem reports—without data leaking between organizations.

## 3. Goals

| Goal | Measure |
|------|---------|
| Reliable incident tracking | Every action logged; invalid state changes rejected |
| Fast onboarding | Sign up → create org → declare incident in &lt; 5 min |
| Operational visibility | Admin dashboard with MTTR, volume, user performance |
| Safe multi-tenancy | Zero cross-org data access in API tests |

## 4. Non-goals (v1)

- PagerDuty / Slack / webhook integrations
- On-call scheduling or paging
- Mobile-native apps
- Custom per-org workflow configuration
- Real-time collaborative editing (websockets)

---

## 5. Personas

| Persona | Role | Needs |
|---------|------|-------|
| **Alex (Engineer)** | ENGINEER | Declare incidents, transition status, comment, upload logs |
| **Jordan (Manager)** | MANAGER | Reassign incidents, change severity, view team workload |
| **Sam (Admin)** | ADMIN | Invite users, manage roles, view org analytics, delete incidents |

---

## 6. User journeys

### 6.1 Onboarding

1. User signs up via Supabase (email/password)
2. User names their organization → backend creates org + admin user
3. Admin invites teammates by email (Supabase invite + local user record)

### 6.2 Incident response

1. Engineer declares incident (title, description, severity)
2. Owner receives email alert (async)
3. Team transitions status: `DETECTED → INVESTIGATING → … → CLOSED`
4. Comments and attachments build the timeline
5. If incident stays `DETECTED` past SLA → auto-escalate to `ESCALATED` + email

### 6.3 Post-incident review

1. User opens post-mortem page for a resolved incident
2. System generates markdown report from audit log (Groq LLM)
3. Report saved to object storage and viewable in-app

---

## 7. Functional requirements

### 7.1 Authentication & organizations

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-1 | Users authenticate via Supabase JWT; API validates every request | P0 |
| AUTH-2 | New users register an organization on first login | P0 |
| AUTH-3 | Admins invite users by email into their org | P1 |
| AUTH-4 | Users cannot register a second org if already provisioned | P0 |

### 7.2 Incidents

| ID | Requirement | Priority |
|----|-------------|----------|
| INC-1 | Create incident with title, description, severity (SEV1–SEV4) | P0 |
| INC-2 | List/filter incidents for current org only | P0 |
| INC-3 | Transition status only via allowed FSM paths | P0 |
| INC-4 | Patch severity and owner (Manager+ for reassignment) | P0 |
| INC-5 | Add comments recorded in audit log | P0 |
| INC-6 | Delete incident (Admin only) | P1 |
| INC-7 | View immutable event timeline per incident | P0 |

**Incident states:** `DETECTED`, `INVESTIGATING`, `MITIGATED`, `RESOLVED`, `POSTMORTEM`, `CLOSED`, `ESCALATED`

### 7.3 RBAC

| Action | Engineer | Manager | Admin |
|--------|----------|---------|-------|
| Create / transition own incidents | ✓ | ✓ | ✓ |
| Comment, upload attachments | ✓ | ✓ | ✓ |
| Reassign / change severity | — | ✓ | ✓ |
| Delete incidents | — | ✓ | ✓ |
| Manage users & roles | — | — | ✓ |
| Admin analytics | — | — | ✓ |

Engineers cannot assign incidents to other users on create.

### 7.4 Attachments

| ID | Requirement | Priority |
|----|-------------|----------|
| ATT-1 | Presigned upload to object storage (no file through API) | P0 |
| ATT-2 | List attachments on incident detail | P0 |
| ATT-3 | Delete own attachment; Admin can delete any | P1 |

### 7.5 SLA & notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| SLA-1 | Background job checks `DETECTED` incidents against severity thresholds | P1 |
| SLA-2 | Breach auto-transitions to `ESCALATED` + audit event | P1 |
| SLA-3 | Email alert on new incident and SLA breach | P1 |

**Default SLA thresholds (time in DETECTED):**

| Severity | Threshold |
|----------|-----------|
| SEV1 | 60 min |
| SEV2 | 120 min |
| SEV3 | 4 hours |
| SEV4 | 24 hours |

### 7.6 Admin analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| ADM-1 | Dashboard: user count, incident count, active incidents, severity breakdown | P1 |
| ADM-2 | Per-user stats: assigned, resolved, comments, escalations | P1 |
| ADM-3 | Charts: MTTR, MTTA, SLA breach rate, volume trend (configurable days) | P1 |

### 7.7 AI post-mortems

| ID | Requirement | Priority |
|----|-------------|----------|
| PM-1 | Generate markdown post-mortem from incident + audit log | P1 |
| PM-2 | Persist report to org-scoped object storage | P1 |
| PM-3 | Fetch previously generated report | P1 |
| PM-4 | Only accessible within owning organization | P0 |

---

## 8. Non-functional requirements

| Category | Requirement |
|----------|-------------|
| **Security** | JWT auth; org-scoped queries; 404 on cross-tenant access |
| **Performance** | API returns without waiting for email/AI jobs |
| **Reliability** | Audit log written in same transaction as state change |
| **Observability** | Health endpoint; structured Celery task logging |
| **Deployability** | Full stack runs via Docker Compose |
| **Testability** | Backend integration tests for core flows + tenant isolation |

---

## 9. UI surfaces

| Screen | Route | Access |
|--------|-------|--------|
| Login | `/login` | Public |
| Register org | `/register` | Authenticated (new users) |
| Incident dashboard | `/` | All roles |
| Admin console | `/admin` | Admin |
| Post-mortem viewer | `/postmortem/[id]` | All roles (org-scoped) |

**Dashboard features:** stat cards, severity/status/assignee filters, incident table, detail panel with history, create/transition modals.

---

## 10. Success criteria (v1 complete)

- [x] User can sign up, create org, and declare an incident
- [x] FSM rejects invalid transitions via API
- [x] Audit log captures status, severity, owner, comment, attachment events
- [x] Cross-org access blocked on incidents, events, attachments, post-mortems
- [x] Admin dashboard renders org metrics
- [x] AI post-mortem generates and persists markdown
- [x] Celery worker processes SLA checks and email tasks
- [x] CI runs backend + frontend tests on every PR

---

## 11. Future roadmap

| Feature | Rationale |
|---------|-----------|
| Slack / PagerDuty webhooks | Auto-create incidents from alerts |
| Configurable SLA per org | Enterprise flexibility |
| Real-time updates | Reduce manual refresh on dashboard |
| Post-mortem templates | Custom sections per org |
| SSO (SAML/OIDC) | Enterprise auth |

---

## 12. Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [API.md](API.md) — endpoint reference
- [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) — technical trade-offs
- [SETUP.md](SETUP.md) — run locally
