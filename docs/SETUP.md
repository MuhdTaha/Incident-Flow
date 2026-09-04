# Setup Guide

Get IncidentFlow running locally for development or demo.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (frontend tests / E2E only)
- A [Supabase](https://supabase.com) project (auth + optional hosted Postgres)

## 1. Clone and configure

```bash
git clone https://github.com/MuhdTaha/Incident-Flow.git
cd Incident-Flow
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
| `FRONTEND_URL` | For invites | App origin used in invite emails. Local default: `http://localhost:3000` |
| `GROQ_API_KEY` | For AI post-mortems | Groq API key |
| `MAILJET_*` | Optional | Production invite + alert email. Local Docker uses Mailhog (`SMTP_HOST`) even if these are set. |
| `S3_*` | Optional | Defaults work with bundled MinIO |
| `DEMO_ORG_ID` | Optional | Org UUID for demo seed (defaults to Default Org `00000000-0000-0000-0000-000000000111`) |

\* Tests use in-memory SQLite and do not need a real database.

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Local: `http://localhost:8000/api/v1`. Deployed: your Render API URL + `/api/v1`. If this still points at Render while you use `localhost:3000`, invites hit production (no Mailhog). |

## 2. Start the stack

```bash
make up          # or: make up-b  to rebuild images
make migrate     # apply Alembic migrations
make seed        # populate demo incidents + audit timelines
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
3. Open the confirmation link in the email to continue (the app will not proceed from the “check your inbox” screen until you do)
4. Enter an organization name — the API creates the org and your admin membership (Auth signup does **not** put you in Default Org)
5. After a short success screen, the dashboard opens an **invite teammates** dialog
6. Invite by email (or skip); teammates can also be invited later from **Admin Console**
7. Invitees open the link in their email, then set a name and password on `/invite`

**Invited teammates:** the invite email includes a link to `/invite`. They set a name and password, then land in the org they were invited to — they do not create a second workspace.

In the Supabase dashboard, add these **Redirect URLs** (Authentication → URL Configuration):

- `http://localhost:3000/invite`
- `http://localhost:3000/register`
- Your production origin + `/invite` (and `/register`) when deployed

**Portfolio demo tip:** Seed data lands in the **Default Org**. Either register into that org (or set `DEMO_ORG_ID` to your org’s UUID) so the dashboard shows the catalog after login. Admins can delete their own workspace from Admin Console; **Default Org cannot be deleted**.

## 4. Demo data

IncidentFlow ships an idempotent demo seeder so local and deployed environments always have a rich audit trail for walkthroughs.

| Command | What it does |
|---------|----------------|
| `make seed` | Ensure demo personas + ~10 catalog incidents with timelines exist |
| `make seed-refresh` | Seed, then append comments / FSM transitions; may open a `Live Demo:` incident |

Equivalent CLI (from `backend/`, or inside the API container):

```bash
python -m scripts.seed_demo
python -m scripts.seed_demo --refresh --actions 4
python -m scripts.seed_demo --refresh --org-id <uuid>
```

**Implementation:** `backend/app/services/demo_seed_service.py`  
**Entrypoint:** `backend/scripts/seed_demo.py`

### What gets seeded

- Demo users: Alex (ADMIN), Sarah (MANAGER), Jordan (ENGINEER), plus a System Bot
- Catalog incidents across severities/statuses (e.g. gateway timeout, DB pool exhaustion, rate limits)
- Immutable `IncidentEvent` rows (creation, status changes, comments, SLA breaches)
- On refresh: new comments, valid FSM transitions, occasional `Live Demo:` incidents (old live rows pruned)

### Keeping demos fresh automatically

| Mechanism | Schedule | Notes |
|-----------|----------|--------|
| Celery Beat → `refresh_demo_data` | Every 2 hours | Needs Redis + `worker` + `beat` (included in Docker Compose; declared in `backend/render.yaml`) |
| GitHub Actions `demo-seed.yml` | Every 6 hours + manual dispatch | Backup when free-tier workers sleep. Requires repo secret `DATABASE_URL` (optional `DEMO_ORG_ID`) |

Seed the **deployed** database once:

```bash
# With DATABASE_URL pointing at Supabase / production Postgres:
cd backend && python3 -m scripts.seed_demo --refresh --actions 4
```

Or trigger **Actions → Demo Seed Refresh → Run workflow** after the secret is set.

## 5. Deploy notes (Vercel + Render + Supabase)

| Piece | Where |
|-------|--------|
| Frontend | Vercel — project **Root Directory** = `frontend`. Set `NEXT_PUBLIC_API_URL` to `https://<render-api>/api/v1` and the same Supabase URL/anon key as local. |
| API + Redis + worker + beat | Render Blueprint [`backend/render.yaml`](../backend/render.yaml). API start command runs `alembic upgrade head` then uvicorn. Set `FRONTEND_URL` on the API to the Vercel origin so invite emails redirect to `/invite`. |
| Postgres | Existing Supabase project (`DATABASE_URL` on API, worker, and beat) |
| Auth | Same Supabase project (JWT secret on the API) |

Set the same `DATABASE_URL` (and optional `DEMO_ORG_ID`) on API, worker, and beat.

**Seed the deployed database once** (from `backend/` with production `DATABASE_URL` / `SUPABASE_*` in the environment):

```bash
DEMO_PASSWORD=IncidentFlow-Demo-2026 python3 -m scripts.seed_demo --provision-auth --refresh --actions 4
```

`SUPABASE_KEY` must be the **secret / service_role** key (Dashboard → Settings → API). The publishable/anon key cannot create users. `python3` is required on Ubuntu/WSL if `python` is not installed.

That creates login-able demo users (Jordan / Sarah / Alex), aligns their Postgres IDs with Auth, and fills the catalog. Credentials: [DEMO.md](DEMO.md).

For the GitHub cron backup: **Settings → Secrets → Actions** → add `DATABASE_URL` matching the Render/Supabase database.

CI Playwright (`ci.yml`) needs:

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project as the app |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Anon / publishable key |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | Confirmed Auth user that already has a Postgres `users` row |
| `SUPABASE_KEY` | Secret / service_role key so CI can reset that user’s password if Auth is in invite-only state |

`frontend/scripts/ensure-e2e-user.mjs` runs before Playwright. Invited users with no password fail as **Invalid login credentials**; the script confirms the email and sets the secret password when `SUPABASE_KEY` is present.

## 6. Run tests

```bash
make test-backend    # Pytest in Docker
make test-frontend   # Jest (host)
make test-e2e        # Playwright — set E2E_USER_* in frontend/.env
```

## 7. Useful commands

```bash
make logs            # follow all container logs
make db-shell        # psql into local Postgres
make shell-backend   # bash in API container
make migration msg="add_field"   # new Alembic revision
make seed            # seed demo incidents + audit timelines
make seed-refresh    # seed + append fresh comments/transitions
make down            # stop containers
make clean           # stop + remove volumes (wipes DB)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 on API calls | Check `SUPABASE_JWT_SECRET` matches Supabase project |
| Frontend can't reach API | Confirm `NEXT_PUBLIC_API_URL` points at the API (`…/api/v1`) |
| Migrations fail | Run `make up` first; ensure `db` container is healthy |
| Post-mortem 503 | Set `GROQ_API_KEY` in `backend/.env` |
| Dashboard empty after seed | Confirm your user is in `DEMO_ORG_ID` / Default Org |
| Deployed dashboard empty | Run `python -m scripts.seed_demo --refresh` against deployed `DATABASE_URL`, or trigger **Demo Seed Refresh** |
| Demo refresh not running on Render | Ensure worker + beat are deployed and share Redis/`DATABASE_URL`; or rely on the GitHub Actions cron |
| Invite returns 501 / “Supabase credentials not configured” | Set `SUPABASE_URL` and the **secret / service_role** `SUPABASE_KEY` on the **Render API** service (not the anon/`sb_publishable_` key). Redeploy after saving. |
| Invite returns 501 mentioning publishable/anon | You pasted the frontend anon key. Use **secret** (`sb_secret_…` or legacy `service_role` JWT) |
| Invite email link lands on the wrong page | Add `https://<vercel-app>/invite` and `http://localhost:3000/invite` to Supabase Auth **Redirect URLs**; set `FRONTEND_URL` on the API to the Vercel origin (e.g. `https://incident-flow-nine.vercel.app`) |
| New signup lands in Default Org instead of naming a workspace | Old `on_auth_user_created` trigger. Redeploy the API so Alembic `b7c8d9e0f1a2` runs (`DROP TRIGGER`). If the migration cannot touch `auth.users`, run `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; DROP FUNCTION IF EXISTS public.handle_new_user();` in the Supabase SQL editor. Existing ghost members can still name a workspace on `/register`. |
| Invite email never arrives | Production needs `MAILJET_*` on the API. Locally, open Mailhog at http://localhost:8025 — invites are sent over SMTP, not through Supabase’s mailer. |
| E2E sign-in failed: Invalid login credentials | The Auth user is missing, unconfirmed, or invite-only. Use a confirmed user (not a pending invite). In CI add `SUPABASE_KEY` so `ensure-e2e-user.mjs` can reset the password. |
