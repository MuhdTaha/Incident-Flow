# IncidentFlow demo script (~5 minutes)

**Live app:** [https://incident-flow-nine.vercel.app](https://incident-flow-nine.vercel.app)  
**Clone:** https://github.com/MuhdTaha/Incident-Flow.git

Use this for interviews and recruiter walkthroughs. Do **not** claim live/realtime updates — the dashboard polls every 30 seconds and shows **Last updated**.

## Accounts

Dedicated demo org. Same password for both roles.

| Role | Email | Password |
|------|-------|----------|
| Engineer | `jordan.dev@company.com` | `IncidentFlow-Demo-2026` |
| Manager | `sarah.ops@company.com` | `IncidentFlow-Demo-2026` |
| Admin | `alex.admin@company.com` | `IncidentFlow-Demo-2026` |

Please don’t change these users’ roles or delete catalog incidents.

## Elevator pitch (30 seconds)

IncidentFlow is a multi-tenant incident manager. Teams declare production issues, move them through a strict state machine, and keep an immutable audit trail for post-mortems. Supabase issues the JWT; **our** Postgres stores role and org — so Admin UI is gated on `GET /users/me`, not JWT metadata. Invalid transitions are rejected. Cross-org access returns 404, not 403.

## Screenshots

Capture these three after the live app is up (dashboard, admin analytics, post-mortem) and drop them in `docs/screenshots/`:

1. **Dashboard** — queue + filters + **Last updated** (not a live badge)
2. **Admin console** — charts + team table (Admin link only when role is `ADMIN`)
3. **Post-mortem** — generated markdown for a resolved incident

```
docs/screenshots/dashboard.png
docs/screenshots/admin.png
docs/screenshots/postmortem.png
```

## 5-minute script

### 1. Engineer — create (≈1 min)

1. Open [the live app](https://incident-flow-nine.vercel.app) (or http://localhost:3000) → sign in as **Jordan**.
2. Confirm the nav shows **ENGINEER** and there is **no** Admin Console link.
3. Point at seeded catalog incidents (gateway timeout, DB pool, etc.).
4. **Declare incident**: title `Demo: checkout latency`, severity **SEV2**, description one sentence, assign to yourself.
5. Talking point: *create is org-scoped; engineers cannot assign to someone else.*

### 2. Transition + comment (≈1 min)

1. Open **Manage** on the new incident.
2. Transition **DETECTED → INVESTIGATING** with a short comment (`Checking p99 on checkout`).
3. Switch to **Comment** and add `Seeing timeouts on the payments hop.`
4. Talking point: *FSM in `app/core/fsm.py` — jumping to CLOSED from DETECTED is rejected. Comment becomes an audit event in the same flow.*

### 3. Admin — analytics (≈1.5 min)

1. Sign out → sign in as **Alex**.
2. Open **Admin Console** (visible because `GET /users/me` returned `ADMIN`).
3. Show performance charts (MTTR / volume) and the team table (assigned / resolved).
4. Talking point: *this page 403s for non-admins on the API; the UI hides the link from engineers so we don’t fake access.*

### 4. Post-mortem (≈1.5 min)

1. Back to the dashboard, open a **RESOLVED** catalog incident (e.g. Database Connection Pool Exhaustion).
2. Open the post-mortem view and **Generate** (or show an existing report).
3. Talking point: *org access is checked before Groq runs; markdown is stored at an org-scoped object key, not in Postgres.*

### Optional extra (if time)

Upload a small log file on the incident you created — presigned POST, API never sees the bytes.

## If something looks empty

Catalog lives in the **Default Org**. Refresh:

```bash
cd backend
python -m scripts.seed_demo --refresh --actions 4
```

On Render, Celery Beat refreshes every 2 hours; GitHub Actions every 6 hours as a backup when free workers sleep.

## Talking points to avoid

- “Realtime / websockets / live sync”
- “SSO / SAML”
- “We store roles on the JWT”
