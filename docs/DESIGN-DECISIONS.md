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

**Decision:** Email alerts, SLA checks, and demo data refresh run in background workers, not in request handlers.

**Why:** API latency stays predictable. Beat scheduler can poll for SLA breaches and keep demo timelines fresh without blocking users.

**Local dev:** Mailhog captures outbound email; Redis ships in Docker Compose. Worker + beat run as Compose services.

---

## 8. Demo seed + scheduled refresh

**Decision:** A dedicated `DemoSeedService` (not ad-hoc SQL in Docker init) owns portfolio demo data. Celery Beat refreshes every 2 hours; GitHub Actions cron every 6 hours as a backup when free-tier workers sleep.

**Why:** Local Docker volumes and deployed Supabase diverge easily. Idempotent seed by incident title keeps both environments demo-ready without wiping real user work. Refresh only mutates catalog / `Live Demo:` rows and respects the FSM.

**Where:** `app/services/demo_seed_service.py`, `scripts/seed_demo.py`, Beat entry in `app/core/celery_app.py`, workflow `.github/workflows/demo-seed.yml`.

---

## 9. AI post-mortems as a separate service

**Decision:** `PostMortemService` verifies org access, loads incident + events, then calls Groq. Output saved to org-scoped S3 keys.

**Why:** Keeps LLM I/O and storage concerns out of incident CRUD. Tenant isolation applied before any external call.

---

## 10. Auth identity vs authorization

**Decision:** Supabase JWT proves *who* the caller is. Postgres `User.role` / `organization_id` decide *what* they can do. The frontend loads that profile via `GET /users/me` into `UserContext`.

**Why:** JWT `app_metadata.role` is not written by this app, so gating Admin / manager UI on it hid features from real users. Identity stays with the IdP; authorization stays in our DB.

---

## 11. Dashboard polling, not realtime

**Decision:** The incident queue refreshes on a 30-second poll plus a manual Refresh button, with a “Last updated” timestamp.

**Why:** Incident rows live in app Postgres (local Docker or hosted), not in Supabase tables. A Supabase Realtime subscription on `incidents` would never fire. Polling is honest about that constraint.

---

## Known limitations (honest scope boundaries)

- Analytics SQL targets Postgres features (test suite mocks some queries for SQLite)
- No websocket / live updates (30s poll + manual refresh)
- Invite flow requires Supabase service role key
- E2E tests need a pre-provisioned Supabase test user
- Demo seed targets one org (`DEMO_ORG_ID`); users in other orgs will not see the catalog

These are documented intentionally — they show awareness of production gaps without over-scoping the capstone.
