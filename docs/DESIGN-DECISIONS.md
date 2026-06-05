# Design Decisions

Key technical choices and trade-offs. Useful for portfolio reviewers evaluating engineering judgment.

## 1. Finite state machine for incidents

**Decision:** Incident status changes go through a explicit transition map, not free-form updates.

**Why:** Prevents ambiguous states (`RESOLVED` while still `INVESTIGATING`) and mirrors how real incident tools (PagerDuty, opsgenie-style workflows) enforce process.

**Where:** `backend/app/core/fsm.py` — validated in `IncidentService` before DB writes.

---

## 2. Multi-tenancy via organization_id

**Decision:** Shared database, row-level isolation using `organization_id` on every tenant table.

**Why:** Simplest model for a capstone scope. Avoids separate DBs per customer while keeping queries explicit and auditable.

**How:** Repositories require `org_id` on reads. Cross-org requests return **404** (not 403) to avoid confirming another tenant's resource IDs exist.

---

## 3. Service → repository layering

**Decision:** Routes never touch SQLAlchemy directly. Services own transactions; repositories only flush.

**Why:** Keeps RBAC and business rules in one place. One commit per use case (e.g. create incident + audit event atomically).

**Trade-off:** More boilerplate than a thin CRUD API, but easier to test and extend.

---

## 4. Supabase for auth, Postgres for app data

**Decision:** Supabase Auth issues JWTs; the FastAPI backend is the source of truth for orgs, roles, and incidents.

**Why:** Offloads password hashing, email verification, and invite flows. Backend stays in control of authorization and tenancy.

---

## 5. Append-only audit log

**Decision:** Every meaningful action creates an `IncidentEvent` row. Events are never updated or deleted.

**Why:** Incident response needs a trustworthy timeline for post-mortems and compliance-style review.

---

## 6. Files in object storage, not Postgres

**Decision:** Attachments and post-mortems stored in MinIO/S3; Postgres holds metadata only.

**Why:** Keeps DB backups small, enables direct browser uploads via presigned URLs, and scales storage independently.

---

## 7. Celery for async work

**Decision:** Email alerts and SLA checks run in background workers, not in request handlers.

**Why:** API latency stays predictable. Beat scheduler can poll for SLA breaches without blocking users.

**Local dev:** Mailhog captures outbound email; Redis ships in Docker Compose.

---

## 8. AI post-mortems as a separate service

**Decision:** `PostMortemService` verifies org access, loads incident + events, then calls Groq. Output saved to org-scoped S3 keys.

**Why:** Keeps LLM I/O and storage concerns out of incident CRUD. Tenant isolation applied before any external call.

---

## Known limitations (honest scope boundaries)

- Analytics SQL targets Postgres features (test suite mocks some queries for SQLite)
- No real-time websocket updates (polling / refresh on navigation)
- Invite flow requires Supabase service role key
- E2E tests need a pre-provisioned Supabase test user

These are documented intentionally — they show awareness of production gaps without over-scoping the capstone.
