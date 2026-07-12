# IncidentFlow

Multi-tenant incident management platform for engineering teams. Track production incidents through a strict lifecycle, maintain an immutable audit trail, enforce RBAC, and generate AI-assisted post-mortems.

**Built by Muhammad Taha** — independent capstone / portfolio project.

## Highlights

- **Finite state machine** for incident status (no invalid transitions)
- **Organization-scoped multi-tenancy** on every data access path
- **Immutable audit log** for every status change, assignment, and comment
- **Background workers** (Celery) for SLA checks, email alerts, and demo data refresh
- **Demo seed** so local and deployed dashboards always have realistic incidents/timelines
- **Direct-to-storage uploads** (MinIO/S3) for attachments and post-mortems
- **AI post-mortems** via Groq, persisted to object storage

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 14, TypeScript, Tailwind, Shadcn UI |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic |
| Auth | Supabase Auth (JWT validated by API) |
| Data | PostgreSQL, Redis, MinIO |
| Jobs | Celery + Celery Beat |
| Tests | Pytest (backend), Jest + Playwright (frontend) |
| Infra | Docker Compose, GitHub Actions |

## Quick start

```bash
git clone https://github.com/yourusername/incidentflow.git
cd incidentflow
cp backend/.env.example backend/.env   # fill in Supabase + optional keys
cp frontend/.env.example frontend/.env
make up
make migrate
make seed          # demo incidents + audit timelines
```

Open **http://localhost:3000**. API docs: **http://localhost:8000/docs**.

See [docs/SETUP.md](docs/SETUP.md) for environment vars, demo seeding, and deploy notes.

## Documentation

| Doc | Purpose |
|-----|---------|
| [PRD.md](docs/PRD.md) | Product requirements, personas, features, success criteria |
| [IMPROVEMENTS.md](docs/IMPROVEMENTS.md) | Prioritized fixes and features for portfolio / demo readiness |
| [SETUP.md](docs/SETUP.md) | Local install, demo seed/refresh, env vars, deploy notes, testing |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, layers, data flow, tenancy model |
| [API.md](docs/API.md) | REST endpoint reference and auth |
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
incidentflow/
├── backend/          # FastAPI API, services, repositories, Celery tasks
│   ├── scripts/      # Demo seed CLI (python -m scripts.seed_demo)
│   └── render.yaml   # Render: API + Redis + worker + beat
├── frontend/         # Next.js app (dashboard, admin, post-mortem)
├── docs/             # Architecture, setup, API, design notes
├── .github/workflows # CI + scheduled demo-seed refresh
├── docker-compose.yml
└── makefile
```
