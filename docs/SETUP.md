# Setup Guide

Get IncidentFlow running locally for development or demo.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (frontend tests / E2E only)
- A [Supabase](https://supabase.com) project (auth + optional hosted Postgres)

## 1. Clone and configure

```bash
git clone <repo-url>
cd incidentflow
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes* | Postgres connection string. Docker Compose overrides this to local `db` service. |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase → Project Settings → API |
| `SUPABASE_URL` | For invites | Supabase project URL |
| `SUPABASE_KEY` | For invites | Supabase service role key |
| `GROQ_API_KEY` | For AI post-mortems | Groq API key |
| `MAILJET_*` | Optional | Production email alerts (Mailhog used locally) |
| `S3_*` | Optional | Defaults work with bundled MinIO |

\* Tests use in-memory SQLite and do not need a real database.

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` |

## 2. Start the stack

```bash
make up          # or: make up-b  to rebuild images
make migrate     # apply Alembic migrations
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Mailhog (email UI) | http://localhost:8025 |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |

## 3. First-time user flow

1. Open http://localhost:3000/register
2. Sign up via Supabase (email/password)
3. Enter an organization name — backend creates org + admin user
4. Sign in and create incidents from the dashboard

## 4. Run tests

```bash
make test-backend    # Pytest in Docker
make test-frontend   # Jest (host)
make test-e2e        # Playwright — set E2E_USER_* in frontend/.env
```

## 5. Useful commands

```bash
make logs            # follow all container logs
make db-shell        # psql into local Postgres
make shell-backend   # bash in API container
make migration msg="add_field"   # new Alembic revision
make down            # stop containers
make clean           # stop + remove volumes (wipes DB)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 on API calls | Check `SUPABASE_JWT_SECRET` matches Supabase project |
| Frontend can't reach API | Confirm `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` |
| Migrations fail | Run `make up` first; ensure `db` container is healthy |
| Post-mortem 503 | Set `GROQ_API_KEY` in `backend/.env` |
