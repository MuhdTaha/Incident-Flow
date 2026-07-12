# Portfolio Improvements

Potential fixes and features to elevate IncidentFlow from a capstone repo to a **professional prototype** for junior SWE interviews and employer demos.

Prioritized by impact vs. effort. See [PRD.md](PRD.md) for shipped scope and [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) for current technical choices.

---

## Critical (before any demo)

### 1. Fix role source-of-truth

**Problem:** Backend stores roles in Postgres (`User.role`). Frontend gates UI with Supabase JWT `user.app_metadata.role` (admin page, action modal, nav).

**Impact:** Admin console and manager actions may not work for real users even when the API allows them.

**Fix:**
- Add `GET /users/me` returning `{ id, role, org_id, full_name }`
- Fetch in `UserContext`; use backend role everywhere—not `app_metadata`

**Interview angle:** *Auth identity from Supabase; authorization from our DB.*

---

### 2. Deploy a public demo

**Problem:** Local-only projects lose most reviewers who won't clone and run Docker.

**Fix:**

| Piece | Suggestion |
|-------|------------|
| Frontend | Vercel |
| API | Railway / Render / Fly.io |
| DB | Supabase Postgres |
| Redis + worker + beat | Required for SLA + demo refresh on Render (`render.yaml`) |

Add to README: live URL, demo credentials. Seed/refresh is shipped — see [SETUP.md](SETUP.md#4-demo-data).

---

### 3. Demo seed data

**Status:** Shipped — `make seed` / `make seed-refresh`, Celery Beat every 2h, GitHub Actions cron every 6h.

See [SETUP.md](SETUP.md#demo-data).

---

### 4. Fix or remove broken realtime hook

**Problem:** `useLiveIncidents` subscribes to Supabase Realtime on `incidents`, but app data lives in **app Postgres** (Docker), not Supabase tables.

**Impact:** Feature appears to exist but does nothing locally—awkward if mentioned in demos.

**Options (pick one):**
- Remove hook; rely on manual refresh (simplest)
- Poll every 30s with a “Last updated” label
- Wire Supabase replication (likely overkill)

---

### 5. Security hygiene

**Problem:** Real secrets must never be committed.

**Fix:**
- Rotate any keys ever committed to git
- Confirm `.env` is gitignored
- Add brief note in docs: secrets via env only; demo uses a dedicated test account

---

## High impact (1–2 days)

### 6. README portfolio front door

Add to README:
- 30-second elevator pitch
- 3 screenshots (dashboard, admin, post-mortem)
- 2-minute Loom/GIF walkthrough link
- Live demo URL + credentials
- “What I built” / “What I learned” bullets
- Update stale roadmap items (AI post-mortems and analytics are shipped)

---

### 7. User-visible error handling

**Problem:** Many failures only log to `console.error`.

**Fix:** Toast/snackbar on:
- Failed incident create
- 403 RBAC denials
- Post-mortem generation failure
- Network errors

---

### 8. Trim dead UI

**Problem:** Profile and Settings in nav do nothing; Admin link visible to all roles.

**Fix:**
- Hide Admin Console unless `role === ADMIN`
- Remove or disable non-functional menu items

---

### 9. Demo script (`docs/DEMO.md`)

Rehearsed 5-minute flow:
1. Login as engineer → create SEV2 incident
2. Transition to INVESTIGATING → add comment
3. Upload attachment
4. Login as admin → analytics
5. Generate post-mortem

---

### 10. Targeted test additions

Don't chase coverage %. Add tests that match interview talking points:

| Test | Why |
|------|-----|
| Auth integration (signed JWT) | Real security boundary |
| `DELETE /incidents` RBAC | Gap in current suite |
| Register success path | Onboarding flow |
| E2E: login → create → transition → events | Critical path |

Add CI badge to README: `31+ tests passing`.

---

## Medium effort

### 11. Unified `UserContext`

Combine Supabase session (identity) + backend profile (role, org). Fixes RBAC UI and clarifies architecture.

### 12. CI coverage reporting

```yaml
pytest --cov=app --cov-report=term-missing
```

Optional `--cov-fail-under` threshold. Badge in README.

### 13. Fix API client fallback URL

`frontend/lib/api.ts` defaults to port `3000`; API runs on `8000`. Fix for SSR/server-side fetch edge cases.

### 14. Structured logging (backend)

Replace `print()` in Celery tasks and services with `logging`. One line in DESIGN-DECISIONS.

---

## Nice to have

| Item | Rationale |
|------|-----------|
| OpenAPI examples on key endpoints | API design signal |
| Empty states on dashboard | “No incidents yet—create one” |
| `LICENSE` (MIT) | Open-source hygiene |
| Architecture diagram image in README | Visual for recruiters |
| Slack webhook stub (mocked) | Integration thinking from PRD roadmap |
| Configurable SLA per org | Enterprise flexibility |
| Real-time websocket updates | Replace polling if realtime is claimed |

---

## Suggested timeline

```
Week 1 — must-have for employers
  ├── Fix role / UserContext + GET /users/me
  ├── Deploy live demo (seed/refresh already shipped)
  ├── README: screenshots, demo URL, video
  └── docs/DEMO.md script

Week 2 — polish
  ├── Toasts + hide dead UI
  ├── Fix or remove realtime hook
  ├── One E2E happy-path test
  └── CI badge

Week 3 — optional
  ├── Extra tests for documented gaps
  └── Logging cleanup
```

---

## Interview talking points (junior depth)

| Topic | One-liner |
|-------|-----------|
| FSM | Invalid state changes rejected; covered by unit + API tests |
| Multi-tenancy | Every query scoped by `organization_id`; cross-org → 404 |
| Layering | Thin routes; services own transactions |
| Celery | Email, SLA, and demo refresh don't block the API |
| Presigned uploads | Files bypass API; DB holds metadata only |
| AI post-mortems | Org access verified before Groq + S3 |

Avoid overselling realtime, SSO, or full observability unless implemented.

---

## Success criteria (demo-ready)

- [x] Seeded demo catalog + scheduled refresh (`make seed`, Beat, GitHub Actions)
- [ ] Live URL works with seeded data (verify after Render worker/beat + GH secret)
- [ ] Admin/manager UI matches backend roles
- [x] 5-minute demo runs without manual DB setup (after seed / auto-refresh)
- [ ] README has screenshots + video link
- [ ] No committed secrets; demo account documented
- [ ] Critical path has at least one E2E test
