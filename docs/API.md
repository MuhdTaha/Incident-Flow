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
| POST | `/orgs/register` | JWT only* | Create org + admin user after Supabase signup. Also claims a leftover Default Org ENGINEER row (Auth-trigger ghost) into the new workspace. |
| POST | `/orgs/invite` | Admin | Invite user via Supabase email (`redirect_to` `/invite`) |
| DELETE | `/orgs/current` | Admin | Delete the current workspace after confirming `{ "name": "<org name>" }`. Demo/Default Org is rejected. Removes org rows, teammates (including Auth logins), incidents, and stored files. |

\* Uses token claims only — user row may not exist yet.

Invite body: `{ "email": "alex@company.com", "role": "ENGINEER" }`. `role` is `ENGINEER` (default), `MANAGER`, or `ADMIN`. A second invite to the same email **resends** while they are still pending; an active teammate returns **409**. The API generates a Supabase invite link and emails it via **Mailjet** (production) or **SMTP/Mailhog** (local). The response includes `invite_url` so an admin can share the link if mail is delayed. The local user is created as `invite_pending` until they set a password on `/invite`. Missing secret-key credentials return **501**. Email send failure returns **502** and rolls back the Auth user.

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
| GET | `/users/me` | Yes | Current user `{ id, role, org_id, full_name, invite_pending, can_create_org }` from Postgres (not JWT `app_metadata`). `can_create_org` is true for unclaimed Default Org ENGINEER signups. |
| PATCH | `/users/me` | Yes | Update own `full_name` / `phone_number` (role changes are ignored) |
| GET | `/users` | Yes | List org users |
| PATCH | `/users/{id}/role` | Admin | Change role |
| DELETE | `/users/{id}` | Admin | Remove user from the org and from Supabase Auth |

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
| 409 | Duplicate email (already in this workspace, or another org) |

## Example: invite a teammate (admin)

```bash
curl -X POST http://localhost:8000/api/v1/orgs/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex@company.com", "role": "ENGINEER"}'
```

The invitee opens `{FRONTEND_URL}/invite`, sets a password, then:

```bash
curl -X PATCH http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Alex Rivera"}'
```

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
