# API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs: **http://localhost:8000/docs** (Swagger UI)

## Authentication

All protected routes require:

```
Authorization: Bearer <supabase_jwt>
```

The API resolves the user from Postgres and enforces `organization_id` on every query.

### Roles

| Role | Capabilities |
|------|--------------|
| **ENGINEER** | Create/transition own incidents, comment, upload attachments |
| **MANAGER** | Reassign incidents, update severity, delete (with admin) |
| **ADMIN** | User management, admin analytics, full incident control |

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |

### Organizations — `/orgs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orgs/org_profile` | Yes | Current org profile |
| POST | `/orgs/register` | JWT only* | Create org + admin user after Supabase signup |
| POST | `/orgs/invite` | Admin | Invite user via Supabase email |

\* Uses token claims only — user row may not exist yet.

### Incidents — `/incidents`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/incidents` | Yes | List org incidents |
| POST | `/incidents` | Yes | Create incident |
| PATCH | `/incidents/{id}` | Manager+ | Update severity / owner |
| DELETE | `/incidents/{id}` | Admin | Delete incident |
| POST | `/incidents/{id}/transition` | Yes | FSM state change |
| POST | `/incidents/{id}/comment` | Yes | Add audit comment |
| GET | `/incidents/{id}/events` | Yes | Audit timeline |
| GET | `/incidents/{id}/postmortem` | Yes | Fetch saved post-mortem |
| POST | `/incidents/{id}/postmortem` | Yes | Generate AI post-mortem |

### Attachments — `/incidents/{id}/attachments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `.../sign` | Yes | Get presigned upload URL |
| POST | `.../complete` | Yes | Register upload in DB |
| GET | `.../` | Yes | List attachments |
| DELETE | `.../{attachment_id}` | Owner or Admin | Remove attachment |

### Users — `/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Yes | List org users |
| PATCH | `/users/{id}/role` | Admin | Change role |
| DELETE | `/users/{id}` | Admin | Remove user |

### Admin — `/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/stats` | Admin | Dashboard counts + user performance |
| GET | `/admin/charts?days=30` | Admin | MTTR, MTTA, SLA breach, volume trend |

## Common responses

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated but wrong role |
| 404 | Resource not found (includes cross-org access) |
| 400 | Invalid FSM transition or business rule violation |

## Example: create incident

```bash
curl -X POST http://localhost:8000/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API latency spike",
    "description": "p99 > 2s on checkout",
    "severity": "SEV2"
  }'
```

## Example: transition state

```bash
curl -X POST http://localhost:8000/api/v1/incidents/{id}/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_state": "INVESTIGATING", "comment": "On call investigating"}'
```
