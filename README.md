# IncidentFlow

Multi-tenant incident management for engineering teams. Declare a production issue, move it through an enforced lifecycle, keep an immutable audit trail, and generate an AI post-mortem — without leaking data across organizations.

**Auth identity from Supabase; authorization from our database.** Built by Muhammad Taha as an independent capstone / portfolio project.

**5-minute walkthrough:** [docs/DEMO.md](docs/DEMO.md)

## Live demo

| | |
|---|---|
| **App** | [incident-flow-nine.vercel.app](https://incident-flow-nine.vercel.app) |
| **API** | Render Blueprint: [`backend/render.yaml`](backend/render.yaml) (API + Redis + worker + beat) |
| **Engineer** | `jordan.dev@company.com` / `IncidentFlow-Demo-2026` |
| **Admin** | `alex.admin@company.com` / `IncidentFlow-Demo-2026` |

These are dedicated test accounts in the shared demo org. Do not reuse them as personal credentials. Provision once against the deployed database:

```bash
cd backend
DEMO_PASSWORD=IncidentFlow-Demo-2026 python3 -m scripts.seed_demo --provision-auth --refresh --actions 4
```

Please don’t delete seeded catalog incidents or change demo-user roles — Celery Beat / GitHub Actions refresh the catalog, they don’t restore wiped rows.

## What I built

- **Finite state machine** — invalid incident transitions are rejected at the service layer
- **Org-scoped multi-tenancy** — every query is filtered by `organization_id`; cross-org access returns 404
- **RBAC** — Engineer / Manager / Admin from Postgres (`GET /users/me`), not JWT `app_metadata`
- **Org invites** — after workspace create (and from Admin), invite by email; teammates join that org via `/invite`
- **Immutable audit log** — status, owner, comment, and attachment events in the same transaction as the change
- **Background jobs** — Celery for email, SLA auto-escalation, and demo-data refresh
- **Presigned uploads** — files go to object storage; the API stores metadata only
- **AI post-mortems** — Groq writes markdown from the timeline, saved per-org in S3/MinIO

## What I learned

- Keep **identity** (IdP JWT) separate from **authorization** (our `User.role`)
- Don’t claim realtime when the data plane isn’t the same database the subscription watches
- Seed + scheduled refresh is what makes a portfolio demo survivable on free-tier hosts

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | Next.js, TypeScript, Tailwind, Shadcn UI |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic |
| Auth | Supabase Auth (JWT validated by the API) |
| Data | PostgreSQL, Redis, MinIO / S3 |
| Jobs | Celery + Celery Beat |
| Tests | Pytest, Jest, Playwright |
| Infra | Docker Compose, GitHub Actions, Vercel, Render |

## Quick start

```bash
git clone https://github.com/MuhdTaha/Incident-Flow.git
cd Incident-Flow
cp backend/.env.example backend/.env   # fill in Supabase + optional keys
cp frontend/.env.example frontend/.env
make up
make migrate
make seed          # demo incidents + audit timelines
```

Open **http://localhost:3000**. API docs: **http://localhost:8000/docs**.

See [docs/SETUP.md](docs/SETUP.md) for environment variables, demo seeding, and deploy notes.

## Documentation

| Doc | Purpose |
|-----|---------|
| [DEMO.md](docs/DEMO.md) | 5-minute interview script and screenshot notes |
| [PRD.md](docs/PRD.md) | Product requirements, personas, features |
| [IMPROVEMENTS.md](docs/IMPROVEMENTS.md) | Prioritized follow-ups |
| [SETUP.md](docs/SETUP.md) | Local install, seed/refresh, env vars, deploy |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, layers, tenancy |
| [API.md](docs/API.md) | REST endpoint reference |
| [DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Why key technical choices were made |

## Commands

```bash
make help           # all commands
make up             # start stack
make migrate        # run Alembic migrations
make seed           # seed demo incidents + audit timelines
make seed-refresh   # seed + append fresh demo activity
make test-backend   # pytest
make test-frontend  # Jest
make test-e2e       # Playwright
```

## Project structure

```
Incident-Flow/
├── backend/          # FastAPI API, services, repositories, Celery tasks
│   ├── scripts/      # Demo seed CLI (python -m scripts.seed_demo)
│   └── render.yaml   # Render: API + Redis + worker + beat
├── frontend/         # Next.js app (dashboard, admin, invite, post-mortem)
├── docs/             # Architecture, setup, API, design notes, demo script
├── .github/workflows # CI + scheduled demo-seed refresh
├── docker-compose.yml
└── makefile
```
