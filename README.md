# IncidentFlow

Multi-tenant incident management platform for engineering teams. Track production incidents through a strict lifecycle, maintain an immutable audit trail, enforce RBAC, and generate AI-assisted post-mortems.

**Built by Muhammad Taha** — independent capstone / portfolio project.

## Highlights

- **Finite state machine** for incident status (no invalid transitions)
- **Organization-scoped multi-tenancy** on every data access path
- **Immutable audit log** for every status change, assignment, and comment
- **Background workers** (Celery) for SLA checks and email alerts
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
```

Open **http://localhost:3000**. API docs: **http://localhost:8000/docs**.

See [docs/SETUP.md](docs/SETUP.md) for full environment and service details.

## Documentation

| Doc | Purpose |
|-----|---------|
| [PRD.md](docs/PRD.md) | Product requirements, personas, features, success criteria |
| [SETUP.md](docs/SETUP.md) | Local install, env vars, Docker services, testing |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, layers, data flow, tenancy model |
| [API.md](docs/API.md) | REST endpoint reference and auth |
| [DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Why key technical choices were made |

## Commands

```bash
make help           # all commands
make up             # start stack
make migrate        # run Alembic migrations
make test-backend   # pytest
make test-frontend  # Jest
make test-e2e       # Playwright
```

## Project structure

```
incidentflow/
├── backend/          # FastAPI API, services, repositories, Celery tasks
├── frontend/         # Next.js app (dashboard, admin, post-mortem)
├── docs/             # Architecture, setup, API, design notes
├── docker-compose.yml
└── makefile
```

## License

MIT (or update as needed)
