# Layer Report: API Surface

**Agent:** api-surface
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian exposes approximately 159 API route handlers via the Next.js App Router file-system convention. The API is well-structured with domain-grouped route prefixes, consistent authentication via the `requireRole()` helper, and Zod validation on write operations. However, there are two distinct auth patterns in use — the canonical `requireRole()` helper vs. inline manual auth checks — creating inconsistency and increasing risk of role-check mistakes. Rate limiting exists but is only applied to AI endpoints. Several corporate and event routes use inline auth (no requireRole), and no API documentation generation is in the CI pipeline despite a Swagger UI page existing in the admin dashboard.

---

## Route Inventory

### AI Endpoints (`/api/ai/*`)
| Method | Route | Auth | Rate Limited |
|--------|-------|------|--------------|
| GET | `/api/ai/briefing` | owner,manager | Yes (20/min) |
| GET | `/api/ai/booking-patterns` | owner,manager | Yes |
| GET | `/api/ai/churn-prediction` | owner,manager | Yes |
| GET | `/api/ai/health-score` | owner,manager | Yes |
| POST | `/api/ai/campaign-copy` | owner,manager | Yes |
| POST | `/api/ai/auto-reply` | owner,manager | Yes |
| GET | `/api/ai/insights` | owner,manager | Unknown |
| POST | `/api/ai/insights/generate` | owner,manager | Unknown |
| POST | `/api/ai/insights/[id]/action` | owner,manager | Unknown |
| POST | `/api/ai/insights/[id]/dismiss` | owner,manager | Unknown |
| GET | `/api/ai/insights/history` | owner,manager | Unknown |
| POST | `/api/ai/intake-enrichment` | owner,manager | Yes |
| GET | `/api/ai/recommendations` | owner,manager | Yes |
| GET | `/api/ai/revenue-anomaly` | owner,manager | Yes |
| POST | `/api/ai/search` | owner,manager | Yes |
| GET | `/api/ai/trainer-summary` | owner,manager | Yes |
| POST | `/api/ai/waitlist-message` | owner,manager | Yes |

### Analytics Endpoints (`/api/analytics/*`)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/analytics/churn-rate` | requireRole |
| GET | `/api/analytics/cohorts` | requireRole |
| GET | `/api/analytics/daily-metrics` | requireRole |
| GET | `/api/analytics/heatmap` | requireRole |
| GET | `/api/analytics/kpi-overview` | requireRole |
| GET | `/api/analytics/member-movement` | requireRole |
| GET | `/api/analytics/revenue-breakdown` | requireRole |
| GET | `/api/analytics/snapshot` | requireRole |
| GET | `/api/analytics/summary` | requireRole |

### Bookings (`/api/bookings/*`)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/bookings` | owner,manager |
| POST | `/api/bookings` | owner,manager |
| POST | `/api/bookings/[id]/cancel` | owner,manager |

### Campaigns (`/api/campaigns/*`)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/campaigns` | requireRole |
| POST | `/api/campaigns` | requireRole |
| GET,PUT,DELETE | `/api/campaigns/[id]` | requireRole |
| POST | `/api/campaigns/[id]/duplicate` | requireRole |
| POST | `/api/campaigns/[id]/pause` | requireRole |
| GET | `/api/campaigns/[id]/recipients` | requireRole |
| POST | `/api/campaigns/[id]/schedule` | requireRole |
| POST | `/api/campaigns/[id]/select-winner` | requireRole |
| POST | `/api/campaigns/process-scheduled` | requireRole |
| POST | `/api/campaigns/send` | requireRole |
| POST | `/api/campaigns/send-test` | requireRole |

### Corporate (`/api/corporate/*`) — INLINE AUTH
| Method | Route | Auth Pattern |
|--------|-------|--------------|
| GET,POST | `/api/corporate` | Inline manual auth |
| GET,PUT | `/api/corporate/[id]` | Inline manual auth |
| GET,POST | `/api/corporate/[id]/credits` | Inline manual auth |
| GET,POST | `/api/corporate/[id]/invoices` | Inline manual auth |
| GET,POST | `/api/corporate/[id]/members` | Inline manual auth |
| DELETE | `/api/corporate/[id]/members/[mid]` | Inline manual auth |
| GET | `/api/corporate/dashboard` | Inline manual auth |

### Events (`/api/events/*`) — INLINE AUTH + DEFAULT_STUDIO_ID
| Method | Route | Auth Pattern |
|--------|-------|--------------|
| GET | `/api/events` | Inline + DEFAULT_STUDIO_ID hardcoded |
| POST | `/api/events` | Inline + DEFAULT_STUDIO_ID hardcoded |
| GET,PUT,DELETE | `/api/events/[id]` | Inline + DEFAULT_STUDIO_ID hardcoded |

### Members (`/api/members/*`)
| Method | Route | Auth |
|--------|-------|------|
| GET,POST | `/api/members` | owner,manager |
| GET,PUT | `/api/members/[id]` | requireRole |
| POST | `/api/members/[id]/pause` | requireRole |

### Other Core Routes
| Method | Route | Auth |
|--------|-------|------|
| GET,POST | `/api/classes` | requireRole |
| GET,PUT,DELETE | `/api/classes/[id]` | requireRole |
| POST | `/api/classes/[id]/remind` | requireRole |
| POST | `/api/check-in` | inline (owner,manager) |
| GET | `/api/check-in/qr` | inline |
| POST | `/api/clock` | requireRole (trainer,staff) |
| GET,POST | `/api/employees` | owner,manager |
| GET,PUT,DELETE | `/api/employees/[id]` | requireRole |
| GET,POST | `/api/invoices/[id]/*` | inline |
| GET,POST | `/api/payroll/periods` | requireRole |
| GET,POST | `/api/pricing-simulator` | requireRole |
| GET,POST | `/api/products` | requireRole |
| GET,POST | `/api/promo-codes` | requireRole |
| GET,POST | `/api/reports` | requireRole |
| GET,PUT,DELETE | `/api/segments/[id]` | requireRole |
| GET,PUT | `/api/settings` | owner |
| POST | `/api/sms/send` | requireRole |
| GET,PUT,DELETE | `/api/staff/[id]` | requireRole |
| GET | `/api/trainers/leaderboard` | requireRole |
| GET | `/api/transactions` | requireRole |
| GET | `/api/revenue` | requireRole |

### Public / Externally-Authenticated Routes
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/health` | Public |
| POST | `/api/leads/capture` | Public (lead intake form) |
| GET | `/api/unsubscribe/[token]` | Token-based |
| POST | `/api/inngest` | Inngest signing key |
| POST | `/api/webhooks/stripe` | Stripe signature verification |
| POST | `/api/webhooks/resend` | Resend signature (svix) |
| POST | `/api/webhooks/easypost` | EasyPost |
| POST | `/api/webhooks/twilio` | Twilio |
| POST | `/api/glofox/sync` | CRON_SECRET header |
| POST | `/api/glofox/backfill` | CRON_SECRET header |
| GET | `/api/openapi` | Public |
| GET/POST | `/api/cron/*` | CRON_SECRET header |

---

## Middleware Chain

```
Request
  → Next.js middleware.ts
    → updateSession() (Supabase session refresh)
    → isPublicRoute() check (allowlist)
    → createServerClient() auth check
    → if no user: 401 JSON (API) or redirect to /login (pages)
    → pass through to route handler
  → Route Handler
    → requireRole(['owner', 'manager']) or inline auth
    → Zod validation (validateBody schema)
    → Supabase query with studioId filter
    → Response
```

---

## Authentication Pattern Analysis

### Pattern 1: `requireRole()` (canonical — preferred)
Used by ~75% of routes. Returns `{ error, user, profile, supabase, studioId }`. If `error` is returned, route handler returns it immediately. Handles auth + role check + studioId resolution in one call.

### Pattern 2: Inline manual auth (legacy/inconsistent)
Used by corporate, events, and some invoice routes. Pattern:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { data: profile } = await supabase.from('profiles').select('id, roles, studio_id')...
const STUDIO_ID = DEFAULT_STUDIO_ID  // ← hardcoded!
```

The critical issue: several event routes use `DEFAULT_STUDIO_ID` (a hardcoded constant) instead of the profile's `studio_id`. This breaks multi-tenancy for the Events API — all events queries go to the default studio regardless of which studio the authenticated user belongs to.

### Role Aliases
`requireRole` supports `"admin"` as an alias for `"owner"` via `ROLE_ALIASES`. This handles the dual-role problem where older profiles have `"admin"` in their roles array.

---

## Findings

### CRITICAL
- **CRIT-AS-001:** Events API (`/api/events/*`) uses `DEFAULT_STUDIO_ID` hardcoded from `@/lib/constants` instead of the authenticated user's `studio_id`. This is a multi-tenancy breach — if Meridian ever serves multiple studios, all event operations would be routed to the same studio regardless of which user is calling the API. Even for single-studio use, this bypasses the multi-tenant isolation pattern that every other endpoint enforces.

### HIGH
- **HIGH-AS-001:** Inconsistent auth patterns across the API. Corporate, Events, and some Invoice routes use inline manual auth rather than the `requireRole()` helper. This creates drift: inline patterns don't get automatic improvements when `requireRole` is updated (e.g., role alias support was added to `requireRole` but may not be reflected in inline implementations).
- **HIGH-AS-002:** Rate limiting is only applied to AI endpoints. High-cost operations like campaign sending (`/api/campaigns/send`), report generation (`/api/reports/[id]/generate`), and payroll calculation (`/api/payroll/periods/[id]/calculate`) have no rate limiting. An authenticated user could trigger expensive operations in rapid succession.
- **HIGH-AS-003:** No API versioning strategy. All 159 routes are unversioned (`/api/...` not `/api/v1/...`). Once member-facing apps (iOS, web booking) are built against these endpoints, breaking changes will have no migration path.

### MEDIUM
- **MED-AS-001:** `/api/openapi` is listed as public in middleware but there is no indication it returns a real OpenAPI spec — only the Swagger UI page at `(admin)/docs/api/page.tsx` exists. If the `/api/openapi` route returns nothing or 404, the public API docs are broken.
- **MED-AS-002:** `/api/campaigns/process-scheduled` is a route handler that appears to process scheduled campaigns — if this is triggered by a cron job or webhook, it should be protected by `CRON_SECRET` rather than user auth.
- **MED-AS-003:** The `check-in/qr` route uses inline auth rather than `requireRole`. QR check-in is a high-frequency operation and should use the canonical auth pattern with appropriate role restrictions.

### LOW
- **LOW-AS-001:** Many routes return generic `{ error: "Internal server error" }` with status 500 without logging the actual error for observability. The `bookings` route does this: `if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })` — the original `error` from Supabase is discarded.
- **LOW-AS-002:** Pagination exists (`limit`/`offset` params) on list endpoints but max limit is capped at 100. For corporate use cases where an admin needs to export all members, this cap may force excessive pagination.
- **LOW-AS-003:** No CORS configuration observed. All API routes will use Next.js default CORS behavior (same-origin only). This is fine for the current admin dashboard, but when the iOS app or third-party integrations need to call these APIs directly, CORS headers will need to be added.

### INFO
- **INFO-AS-001:** The `requireRole()` helper makes a profile lookup on every authenticated request (2 DB calls: `auth.getUser()` + `profiles` select). This is efficient but means every API call incurs at least 2 Supabase round-trips.
- **INFO-AS-002:** 159 total route files discovered — an extensive API surface for a Phase 1+2 system. Many future-phase routes (shipping, events detail, payroll export) are already implemented.
- **INFO-AS-003:** Glofox write-back (booking creation) uses fire-and-forget Inngest events rather than synchronous calls. This is the correct pattern for external API integration.
