# Architecture

High-level design of IncidentFlow for reviewers and contributors.

## System overview

```
┌─────────────┐     JWT      ┌─────────────┬─────────────┐
│  Next.js    │ ───────────► │   FastAPI    │             │
│  Frontend   │ ◄─────────── │   (API)      │             │
└─────────────┘   REST       └──────┬───────┘             │
                                    │                     │
                    ┌───────────────┼───────────────┐     │
                    ▼               ▼               ▼     │
              PostgreSQL         Redis           MinIO    │
                    ▲               │                     │
                    │               ▼                     │
                    │         Celery Worker ◄─────────────┘
                    │         Celery Beat (SLA checks)
                    └───────────────────────────────────
```

**Auth flow:** Supabase handles sign-up/login. The frontend sends the Supabase JWT as `Authorization: Bearer`. The API validates the token, loads the user from Postgres, and scopes all queries to `organization_id`.

## Backend layers

```
HTTP Route  →  Service  →  Repository  →  PostgreSQL
(deps.py)      (business)   (queries)
```

| Layer | Role |
|-------|------|
| **Routes** (`app/api/v1/endpoints/`) | HTTP only — parse input, call service, return response |
| **Dependencies** (`app/api/deps.py`) | Auth, org ID, role checks, service injection |
| **Services** (`app/services/`) | Business rules, RBAC, transactions (single commit per use case) |
| **Repositories** (`app/repositories/`) | SQLAlchemy queries; org-scoped reads/writes |
| **Models** (`app/db/models.py`) | SQLAlchemy ORM entities |

External integrations live in `app/core/` (storage, Celery tasks, FSM).

## Core domain model

```
Organization ──┬── User (ADMIN | MANAGER | ENGINEER)
               └── Incident ──┬── IncidentEvent (audit log)
                              └── IncidentAttachment (metadata; files in MinIO)
```

Every tenant-owned row includes `organization_id`. Cross-org access returns 404 (not 403) to avoid leaking resource existence.

## Incident lifecycle (FSM)

Statuses and allowed transitions are defined in `backend/app/core/fsm.py`:

```
DETECTED → INVESTIGATING | CLOSED | ESCALATED
INVESTIGATING → MITIGATED | ESCALATED
MITIGATED → RESOLVED | INVESTIGATING
RESOLVED → POSTMORTEM | CLOSED | MITIGATED
POSTMORTEM → CLOSED
ESCALATED → INVESTIGATING
CLOSED → (terminal)
```

Invalid transitions are rejected at the service layer before any DB write.

## Async & background work

| Task | Trigger | Worker |
|------|---------|--------|
| New incident email | Incident created | Celery |
| SLA breach check | Scheduled (Beat) | Celery |
| Auto-escalation | Incident past SLA threshold | Celery |

Redis is the message broker. API requests stay fast; workers handle I/O-heavy work.

## File storage

Attachments and post-mortems are **not** stored in Postgres:

- **Attachments:** presigned POST upload to MinIO → metadata row in DB
- **Post-mortems:** Groq generates markdown → saved to `orgs/{org_id}/postmortems/{incident_id}/latest.md`

## Frontend structure

| Route | Purpose |
|-------|---------|
| `/` | Incident dashboard (list, filter, actions) |
| `/admin` | Analytics and user metrics (admin only) |
| `/postmortem/[id]` | View / generate AI post-mortem |
| `/login`, `/register` | Supabase auth + org onboarding |

State: React Context for current user; API calls via fetch with Supabase session token.

## Security summary

- JWT validation on every protected route
- Role-based access (Admin / Manager / Engineer)
- Mandatory org scoping in repositories
- Presigned uploads (no file bytes through API)
