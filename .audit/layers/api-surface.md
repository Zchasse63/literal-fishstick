# API Surface Audit Report

**Agent**: api-surface
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Routes examined**: 148 API route handlers across 50+ domain directories
- **Auth infrastructure**: `lib/auth/require-role.ts`, `lib/auth/get-studio-id.ts`, `src/middleware.ts`
- **Webhook handlers**: Stripe, Resend (Svix), Twilio, EasyPost
- **External integrations**: Anthropic AI (13 endpoints), Glofox API, Resend, Twilio, Stripe, Inngest
- **Supporting files**: `lib/rate-limit.ts`, `netlify.toml`, `next.config.ts`, `public/openapi.yaml`

---

## Executive Summary

The API surface is large (148 routes), functionally complete for Phase 1, and shows thoughtful design in places — strong webhook signature verification, a well-structured `requireRole()` helper, and consistent `{ data: ... }` response envelopes. However, the surface has a structural fracture: only 26 of 148 routes use the canonical `requireRole()` helper. The remaining 114 routes with user auth implement ad-hoc auth manually, creating two enforcement paths with different semantics. The most critical problem is a role alias mismatch: the canonical helper normalizes `"owner"` and `"admin"` as equivalent, but ~20 ad-hoc routes check only `"admin"` — meaning any account that was assigned the canonical `"owner"` role (not the legacy `"admin"` string) will be incorrectly refused by those routes.

The in-memory rate limiter is ineffective in the Netlify serverless environment and provides no real protection. Three webhook handlers conditionally skip signature verification when environment variables are absent, which creates an exploitable bypass in under-configured deployments. The OpenAPI spec covers roughly 15 of 148 routes.

---

## Findings by Severity

### CRITICAL

#### C-1: Role Alias Mismatch Causes Silent Authorization Bypass

**Affected routes**: ~20 routes across `leads/`, `content/`, `automations/`, `reports/`, `cron/waitlist-promote`

The canonical `requireRole()` helper in `lib/auth/require-role.ts` defines a `ROLE_ALIASES` map that treats `"owner"` and `"admin"` as interchangeable. This means an account with `roles: ["owner"]` will correctly pass `requireRole(["owner"])`.

However, routes that bypass `requireRole()` and implement ad-hoc role checking frequently check for `["admin", "manager"]` rather than `["owner", "manager"]`. A user with role `"owner"` (the canonical value) will fail the check:

```typescript
// In /api/content/route.ts, /api/automations/route.ts, /api/reports/route.ts, etc.
const ALLOWED_ROLES = ["admin", "manager"];
if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

```typescript
// In /api/leads/score/route.ts
if (!roles.some((r: string) => ["admin", "manager"].includes(r))) { ... }
```

```typescript
// In /api/cron/waitlist-promote/route.ts (checks both, but inconsistently)
if (!roles.includes("admin") && !roles.includes("owner")) { ... }
```

**Impact**: An `"owner"` account would be silently refused from listing their own content posts, managing automations, accessing reports, converting leads, and triggering waitlist promotion. A user with legacy `"admin"` role would pass but `"owner"` would not — the opposite of the intended hierarchy. This is a correctness failure that will surface immediately when a new account is created with the canonical `"owner"` role.

**Fix**: Replace all ad-hoc `["admin", "manager"]` arrays with `["owner", "manager"]`, or migrate those routes to use `requireRole()` which handles the alias automatically.

---

#### C-2: In-Memory Rate Limiter Is Ineffective in Serverless

**File**: `apps/web/src/lib/rate-limit.ts`

The rate limiter stores state in a module-level `Map`. In Netlify's serverless environment, each function invocation runs in an isolated context. There is no shared memory between requests. The limiter comment acknowledges this:

> "Suitable for single-instance deployments. For multi-instance / serverless, replace with a Redis-backed implementation."

**Impact**: The rate limiter applied to all 13 AI endpoints (`ai:${userId}` key, 20 req/min) and the SMS endpoint provides zero protection in production. An authenticated user can invoke the Anthropic API endpoint 20 times per minute per serverless instance with no actual throttling. At typical Netlify concurrency, this means unbounded Anthropic API spend. The leads capture rate limiter (10 req/min by IP) is also ineffective.

**Cost exposure**: Each Anthropic API call costs real money. A malicious or buggy client could exhaust the monthly AI budget in minutes.

**Fix**: Replace with an upstash/redis or Netlify KV-backed rate limiter before any production AI feature launch.

---

### HIGH

#### H-1: Three Webhook Handlers Conditionally Skip Signature Verification

**Affected routes**:
- `POST /api/webhooks/easypost` — skips HMAC check when `EASYPOST_WEBHOOK_SECRET` is unset
- `POST /api/webhooks/twilio` — skips signature check when `TWILIO_AUTH_TOKEN` is unset
- `POST /api/webhooks/twilio` — silently accepts if `validateRequest` throws (returns 500, not 403)

```typescript
// easypost/route.ts — unauthenticated path in "dev mode"
if (webhookSecret) {
  // ...verify...
}
// No secret configured — parse body directly (development mode)
const event = await request.json()
return await handleEvent(event)
```

```typescript
// twilio/route.ts — auth only when env var is present
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (authToken) {
  // ...validate...
}
// Falls through to handler if no auth token
```

**Impact**: Any unauthenticated request can trigger EasyPost and Twilio webhook processing if the environment variables are absent — a realistic scenario in staging, preview deployments, or misconfigured production. EasyPost processing writes to `shipping_labels` and `orders` tables. Twilio processing logs inbound SMS. The Stripe and Resend handlers do not have this flaw (they always verify).

**Fix**: Make `EASYPOST_WEBHOOK_SECRET` and `TWILIO_AUTH_TOKEN` required and fail hard at startup or first request if missing.

---

#### H-2: Inngest Endpoint Has No Explicit Signing Key Configured

**File**: `apps/web/src/app/api/inngest/route.ts`

```typescript
export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

The Inngest client is initialized with only `{ id: 'meridian' }` — no `signingKey` is explicitly set in code. Inngest's SDK reads `INNGEST_SIGNING_KEY` from the environment automatically, but this is not documented or enforced in the codebase. There is no `.env.example` file to confirm this variable is configured.

**Impact**: If `INNGEST_SIGNING_KEY` is not set in the Netlify environment, Inngest may operate in development/unsigned mode, accepting function invocations from any caller. The Inngest endpoint is listed as a public route in middleware (bypasses the session check):

```typescript
"/api/inngest",  // Inngest webhook endpoint (verified via signing key)
```

The comment says "verified via signing key" — but that verification only happens if the key is configured.

**Fix**: Add `INNGEST_SIGNING_KEY` to the environment variable documentation. Add a startup assertion that fails loudly if the key is absent in production.

---

#### H-3: 43 Routes Use Hardcoded `STUDIO_ID` Constant

**Pattern**:
```typescript
const STUDIO_ID = "11111111-1111-1111-1111-111111111111";
```

43 of 148 routes define this constant at module level and use it for all database queries. This includes high-sensitivity routes: all invoice operations, all corporate account operations, all event operations, all campaign sub-routes, AI routes, and the SMS sender.

**Impact for current single-tenant deployment**: Low — the hardcoded ID matches the production studio. **Impact for multi-tenant readiness**: Breaking. When a second studio is onboarded, all 43 routes will serve the wrong data regardless of which authenticated user makes the request. Any authenticated user from Studio B could read and write Studio A's invoices, corporate accounts, events, and campaigns — the hardcoded ID completely bypasses the per-user studio scoping.

A utility (`getStudioId()`) was created specifically to solve this, and 26 routes already use it via `requireRole()`. The remaining 43 have not been migrated. The project structure audit noted this as "MED-008."

**Fix**: Replace all `const STUDIO_ID = "11111111..."` instances with `getStudioId(profile)` derived from the authenticated user's profile.

---

#### H-4: OpenAPI Spec Documents ~10% of the API Surface

**File**: `apps/web/public/openapi.yaml`

The spec declares coverage of the API but documents only approximately 15 paths out of 148 routes. The following domains have zero OpenAPI coverage:

- All `ai/` endpoints (13 routes)
- All `analytics/` endpoints (7 routes)
- All `automations/` endpoints (6 routes)
- All `campaigns/` sub-routes (`/send`, `/send-test`, `/process-scheduled`, `/duplicate`, `/pause`, `/schedule`, `/select-winner`, `/recipients`)
- All `clock/`, `content/`, `cron/`, `email-preferences/`, `email-templates/` routes
- All `employees/`, `geofence/`, `glofox/`, `inngest/` routes
- All `invoices/`, `leads/`, `migration/`, `orders/`, `payroll/` routes
- All `pricing-simulator/`, `products/`, `qr/`, `reports/`, `revenue/` routes
- All `segments/`, `settings/`, `shipping/`, `sms/`, `staff/`, `trainers/`, `transactions/` routes
- All `webhooks/` endpoints
- All `unsubscribe/` endpoints

The spec also documents `GET /auth/profile` but the actual implementation only exports `POST`.

**Impact**: The `GET /api/openapi` endpoint is marked public and advertised to API consumers, but the spec is misleading. Any third-party integration built on this spec will silently fail for the undocumented endpoints.

---

### MEDIUM

#### M-1: 114 Routes Use Ad-Hoc Auth Instead of `requireRole()`

**Pattern**: The ad-hoc pattern requires 3-5 extra database queries and 15-20 lines of boilerplate per route compared to the 3-line `requireRole()` pattern. More importantly, the ad-hoc pattern is inconsistently implemented:

- Some routes check `profile?.studio_id ?? "11111111-..."` (inline fallback)
- Some routes use `getStudioId(profile)` (the correct utility)
- Some routes check `"admin"` alias, others check `"owner"`
- Some routes fetch profile fields `("studio_id, roles")`, others fetch only `("roles")`

This creates a maintenance surface where every security fix must be applied to 114 separate implementations rather than one shared helper.

**Recommendation**: Migrate all ad-hoc auth to `requireRole()`. The function already returns `{ error, user, profile, supabase, studioId }` — the exact data every route needs.

---

#### M-2: Content Listing Accessible to Any Authenticated User (No Role Filter)

**Route**: `GET /api/content`

The content listing endpoint checks authentication but applies no role restriction. Any authenticated user (including a `"member"` role) can list all content posts for the studio:

```typescript
// No role check in GET /api/content
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// Immediately queries content_posts without checking roles
```

The `POST` handler correctly restricts creation to `STAFF_ROLES = ["admin", "manager", "trainer", "staff"]`. The `PUT` and `DELETE` handlers check that only the author or admin/manager can modify. But the `GET` returns all posts including drafts (`is_published: false`) if no filter is applied.

**Impact**: A studio member could read internal unpublished content drafts. In a Phase 5 member-facing context, this would expose admin-only content.

---

#### M-3: Cron Secret Accepted via `Authorization: Bearer` Header (Non-Standard)

**Route**: `POST /api/leads/score`

This route accepts the cron secret as a `Bearer` token in the `Authorization` header, while all other cron/scheduled routes use an `x-cron-secret` custom header. This inconsistency means external tools or monitoring cannot uniformly invoke scheduled endpoints.

```typescript
// leads/score — uses Authorization header
const authHeader = request.headers.get("authorization");
const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

// cron/waitlist-promote and campaigns/process-scheduled — use x-cron-secret
const cronSecret = request.headers.get("x-cron-secret");
```

---

#### M-4: `GET /api/auth/profile` Documented as `GET` but Only Exports `POST`

**Route**: `apps/web/src/app/api/auth/profile/route.ts`

The OpenAPI spec documents `GET /auth/profile` as the endpoint for retrieving the current user's profile. The implementation only exports `POST`. A `GET` request to this endpoint will receive a 405 Method Not Allowed error.

---

#### M-5: Missing Security Headers (CSP, HSTS)

**File**: `netlify.toml`

The Netlify configuration sets four security headers but is missing the two most important:

```toml
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Referrer-Policy = "strict-origin-when-cross-origin"
Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

Missing:
- `Content-Security-Policy` — no protection against XSS, inline script injection
- `Strict-Transport-Security` — no HTTPS enforcement (HSTS)

The `next.config.ts` also sets no additional headers.

---

#### M-6: Twilio Webhook Accepts Request Even When Signature Validation Throws

**Route**: `POST /api/webhooks/twilio`

```typescript
} catch (err) {
  console.error('[webhook:twilio] Signature validation error:', err);
  return NextResponse.json(
    { error: 'Signature validation failed' },
    { status: 500 },
  );
}
```

When `validateRequest` throws (e.g., malformed header format), the handler returns 500 but has already done `await request.clone().text()` — a consumed stream. The real issue is that the flow continues into the handler after the try/catch if the outer try block doesn't catch it. The 500 response is correct behavior, but the error message reveals the internal validation mechanism to attackers.

---

#### M-7: Reports and Payroll Routes Use `"admin"` Role Alias

**Affected routes**: All `reports/` routes, all `payroll/periods/` routes

These financial report and payroll routes define:
```typescript
const ALLOWED_ROLES = ["admin", "manager"];
```

Payroll approval, calculation, and export — highly sensitive operations — will refuse a user with the canonical `"owner"` role. Combined with finding C-1, this means the highest-privileged account in the system cannot access payroll data through these routes.

---

### LOW

#### L-1: `ALLOWED_ROLES` for AI Insights GET Includes `"trainer"`

**Route**: `GET /api/ai/insights`

The insights listing endpoint allows `["owner", "manager", "trainer"]`. This is intentional per the business model (trainers see their performance insights), but it differs from the pattern of every other AI endpoint which restricts to `["owner", "manager"]`. This asymmetry should be documented.

---

#### L-2: Rate Limiter Key for AI Routes Is Per-User-ID, Not Per-Route

All 13 AI endpoints share a single rate limit bucket keyed `ai:${userId}`. Triggering the rate limit on the cheap `briefing` endpoint will block the user from the expensive `churn-prediction` endpoint and vice versa. A burst of read-only operations could prevent write-critical AI operations.

---

#### L-3: `leads/score` Uses a Hardcoded 100-Lead Batch Cap

The scoring route processes `MAX_LEADS_PER_RUN = 100` leads per invocation and relies on sequential cron calls to process the rest. This is intentional but undocumented. If the lead database grows faster than the cron runs, leads will accumulate with stale scores.

---

#### L-4: EasyPost Webhook Uses `createServerClient()` (Cookie-Based) Instead of Service Role

**Route**: `POST /api/webhooks/easypost`

```typescript
const supabase = await createServerClient()
```

The Stripe webhook correctly uses a service-role client for server-to-server operations. EasyPost uses the cookie-based server client, which requires a valid session. Since webhooks arrive with no user cookies, the Supabase client will run as an unauthenticated user. This will only succeed if the `shipping_labels` and `orders` tables have permissive RLS policies for unauthenticated reads/writes.

---

#### L-5: `GET /api/cron/waitlist-promote` Is a GET with Side Effects

The cron endpoint exports both `GET` and `POST` with identical behavior — `GET` delegates directly to `POST`. HTTP GET with side effects violates REST semantics and will cause problems with proxies, CDNs, and browsers that cache or prefetch GET responses.

---

## Complete Endpoint Map

### Authentication (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| POST | `/api/auth/profile` | getUser | any authenticated | Create profile on first sign-in |

### Members (5 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/members` | requireRole | owner, manager | Paginated list with search/filter |
| POST | `/api/members` | requireRole | owner, manager | Create member |
| GET | `/api/members/:id` | ad-hoc | owner, manager | Member detail with full profile |
| PUT | `/api/members/:id` | ad-hoc | owner, manager | Update member (roles field excluded) |
| DELETE | `/api/members/:id` | ad-hoc | owner, manager | Soft delete |
| GET+POST+DELETE | `/api/members/:id/tags` | ad-hoc | owner, manager | Member tag management |
| POST | `/api/members/:id/upgrade` | ad-hoc | owner, manager | Stripe membership upgrade |
| POST | `/api/members/:id/downgrade` | ad-hoc | owner, manager | Membership downgrade |

### Classes (2 routes, 3 methods each)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/classes` | ad-hoc | owner, manager | List classes with filters |
| POST | `/api/classes` | ad-hoc | owner, manager | Create class |
| GET | `/api/classes/:id` | ad-hoc | owner, manager | Class detail |
| PUT | `/api/classes/:id` | ad-hoc | owner, manager | Update class |
| DELETE | `/api/classes/:id` | ad-hoc | owner, manager | Delete class |

### Bookings (3 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/bookings` | requireRole | owner, manager | List bookings |
| POST | `/api/bookings` | requireRole | owner, manager | Create booking (atomic capacity check) |
| POST | `/api/bookings/:id/cancel` | ad-hoc | owner, manager | Cancel with strike logic |

### Check-in (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| POST | `/api/check-in` | ad-hoc | any staff | QR or manual check-in |
| POST | `/api/check-in/qr` | ad-hoc | any staff | QR code check-in processing |

### Revenue & Transactions (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/revenue` | ad-hoc | owner, manager | Revenue metrics (MRR, ARR, churn) |
| GET | `/api/transactions` | ad-hoc | owner, manager | Transaction list |
| POST | `/api/transactions` | ad-hoc | owner, manager | Record transaction |

### Members' Email Preferences (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/email-preferences/:memberId` | ad-hoc | self or owner/manager | Read email prefs |
| PUT | `/api/email-preferences/:memberId` | ad-hoc | self or owner/manager | Update email prefs |

### Campaigns (11 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/campaigns` | requireRole | owner, manager | List campaigns |
| POST | `/api/campaigns` | requireRole | owner, manager | Create campaign |
| GET | `/api/campaigns/:id` | ad-hoc | owner, manager | Campaign detail |
| PUT | `/api/campaigns/:id` | ad-hoc | owner, manager | Update campaign |
| DELETE | `/api/campaigns/:id` | ad-hoc | owner, manager | Delete campaign |
| GET | `/api/campaigns/:id/recipients` | ad-hoc | owner, manager | List recipients |
| POST | `/api/campaigns/:id/duplicate` | ad-hoc | owner, manager | Clone campaign |
| POST | `/api/campaigns/:id/pause` | ad-hoc | owner, manager | Pause active campaign |
| POST | `/api/campaigns/:id/schedule` | ad-hoc | owner, manager | Schedule for future send |
| POST | `/api/campaigns/:id/select-winner` | ad-hoc | owner, manager | A/B test winner selection |
| POST | `/api/campaigns/send` | ad-hoc | owner, manager | Immediate send |
| POST | `/api/campaigns/send-test` | ad-hoc | owner, manager | Send test email |
| POST | `/api/campaigns/process-scheduled` | cron+auth | owner, manager | Cron: process due campaigns |

### Automations (6 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/automations` | ad-hoc | admin, manager (alias bug) | List automations |
| POST | `/api/automations` | ad-hoc | admin, manager (alias bug) | Create automation |
| GET | `/api/automations/:id` | ad-hoc | admin, manager (alias bug) | Automation detail |
| PUT | `/api/automations/:id` | ad-hoc | admin, manager (alias bug) | Update automation |
| DELETE | `/api/automations/:id` | ad-hoc | admin, manager (alias bug) | Delete automation |
| POST | `/api/automations/:id/activate` | ad-hoc | admin, manager (alias bug) | Activate automation |
| POST | `/api/automations/:id/deactivate` | ad-hoc | admin, manager (alias bug) | Deactivate automation |
| GET | `/api/automations/:id/enrollments` | ad-hoc | admin, manager (alias bug) | List enrollments |
| POST | `/api/automations/:id/enrollments/:eid/exit` | ad-hoc | admin, manager (alias bug) | Exit member from automation |

### Leads (6 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| POST | `/api/leads/capture` | **PUBLIC** | none | Rate-limited lead capture form |
| GET | `/api/leads` | ad-hoc | admin, manager (alias bug) | List leads |
| POST | `/api/leads` | ad-hoc | admin, manager (alias bug) | Create lead |
| POST | `/api/leads/score` | cron+auth | admin, manager (alias bug) | Batch rescore leads |
| GET | `/api/leads/:id` | ad-hoc | admin, manager (alias bug) | Lead detail |
| PUT | `/api/leads/:id` | ad-hoc | admin, manager (alias bug) | Update lead |
| DELETE | `/api/leads/:id` | ad-hoc | admin, manager (alias bug) | Delete lead |
| POST | `/api/leads/:id/activity` | ad-hoc | admin, manager (alias bug) | Log activity |
| POST | `/api/leads/:id/convert` | ad-hoc | admin, manager (alias bug) | Convert to member |

### Content (4 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/content` | ad-hoc | **any authenticated** | No role restriction on reads |
| POST | `/api/content` | ad-hoc | staff roles | Create post |
| GET | `/api/content/:id` | ad-hoc | **any authenticated** | No role restriction |
| PUT | `/api/content/:id` | ad-hoc | author or owner/manager | Role-aware update |
| DELETE | `/api/content/:id` | ad-hoc | author or owner/manager | Role-aware delete |
| POST | `/api/content/:id/comment` | ad-hoc | any authenticated | Add comment |
| POST | `/api/content/:id/like` | ad-hoc | any authenticated | Toggle like |

### Corporate (7 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/corporate` | ad-hoc | owner, manager | List company accounts |
| POST | `/api/corporate` | ad-hoc | owner, manager | Create company account |
| GET | `/api/corporate/dashboard` | ad-hoc | owner, manager | Dashboard summary |
| GET | `/api/corporate/:id` | ad-hoc | owner, manager | Account detail |
| PUT | `/api/corporate/:id` | ad-hoc | owner, manager | Update account |
| DELETE | `/api/corporate/:id` | ad-hoc | owner, manager | Delete account |
| GET | `/api/corporate/:id/members` | ad-hoc | owner, manager | List account members |
| POST | `/api/corporate/:id/members` | ad-hoc | owner, manager | Add member to account |
| DELETE | `/api/corporate/:id/members/:mid` | ad-hoc | owner, manager | Remove member |
| POST | `/api/corporate/:id/credits` | ad-hoc | owner, manager | Allocate credits |
| GET | `/api/corporate/:id/invoices` | ad-hoc | owner, manager | List invoices |
| POST | `/api/corporate/:id/invoices` | ad-hoc | owner, manager | Create invoice |

### Events (5 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/events` | ad-hoc | owner, manager | List events |
| POST | `/api/events` | ad-hoc | owner, manager | Create event |
| GET | `/api/events/:id` | ad-hoc | owner, manager | Event detail |
| PUT | `/api/events/:id` | ad-hoc | owner, manager | Update event |
| DELETE | `/api/events/:id` | ad-hoc | owner, manager | Delete event |
| POST | `/api/events/:id/confirm` | ad-hoc | owner, manager | Confirm event |
| POST | `/api/events/:id/quote` | ad-hoc | owner, manager | Generate quote |
| GET | `/api/events/:id/guests` | ad-hoc | owner, manager | List guests |
| POST | `/api/events/:id/guests` | ad-hoc | owner, manager | Add guest |
| PUT | `/api/events/:id/guests/:gid` | ad-hoc | owner, manager | Update guest |

### Invoices (5 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/invoices/:id` | ad-hoc | owner, manager | Invoice detail |
| PUT | `/api/invoices/:id` | ad-hoc | owner, manager | Update invoice |
| POST | `/api/invoices/:id/pdf` | ad-hoc | owner, manager | Generate PDF |
| POST | `/api/invoices/:id/record-payment` | ad-hoc | owner, manager | Record payment |
| POST | `/api/invoices/:id/send` | ad-hoc | owner, manager | Send via email |
| POST | `/api/invoices/:id/void` | ad-hoc | owner, manager | Void invoice |

### Staff & Employees (3 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/staff` | ad-hoc | owner, manager | List staff |
| POST | `/api/staff` | ad-hoc | owner, manager | Create staff record |
| GET | `/api/staff/:id` | ad-hoc | owner, manager | Staff detail |
| PUT | `/api/staff/:id` | ad-hoc | owner, manager | Update staff |
| DELETE | `/api/staff/:id` | ad-hoc | owner, manager | Remove staff |
| GET | `/api/employees/:id/documents` | ad-hoc | owner, manager | List documents |
| POST | `/api/employees/:id/documents` | ad-hoc | owner, manager | Upload document |
| GET | `/api/employees/:id/documents/:did` | ad-hoc | owner, manager | Get document |
| PUT | `/api/employees/:id/documents/:did` | ad-hoc | owner, manager | Update document |
| DELETE | `/api/employees/:id/documents/:did` | ad-hoc | owner, manager | Delete document |

### Clock (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| POST | `/api/clock` | ad-hoc | owner, manager, trainer, staff | Clock in/out with geofence |

### Payroll (6 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/payroll/periods` | ad-hoc | owner, manager | List payroll periods |
| POST | `/api/payroll/periods` | ad-hoc | owner, manager | Create period |
| GET | `/api/payroll/periods/:id` | ad-hoc | owner, manager | Period detail |
| PUT | `/api/payroll/periods/:id/approve` | ad-hoc | owner, manager | Approve period |
| POST | `/api/payroll/periods/:id/calculate` | ad-hoc | owner, manager | Run calculation |
| POST | `/api/payroll/periods/:id/export` | ad-hoc | owner, manager | Export to CSV |
| POST | `/api/payroll/periods/:id/reopen` | ad-hoc | owner, manager | Reopen approved period |

### Analytics (7 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/analytics/summary` | requireRole | owner, manager | High-level KPI summary |
| GET | `/api/analytics/daily-metrics` | requireRole | owner, manager | Day-by-day metrics |
| GET | `/api/analytics/heatmap` | requireRole | owner, manager | Attendance heatmap |
| GET | `/api/analytics/cohorts` | requireRole | owner, manager | Retention cohort analysis |
| GET | `/api/analytics/member-movement` | requireRole | owner, manager | Churn/gain movement |
| GET | `/api/analytics/revenue-breakdown` | requireRole | owner, manager | Revenue by category |
| POST | `/api/analytics/snapshot` | ad-hoc | owner, manager | Trigger metric snapshot |

### AI Endpoints (17 routes)

| Method | Path | Auth | Role Required | Rate Limited | Notes |
|--------|------|------|---------------|--------------|-------|
| GET | `/api/ai/briefing` | requireRole | owner, manager | Yes (20/min) | Command Center AI brief |
| GET | `/api/ai/booking-patterns` | requireRole | owner, manager | Yes (20/min) | Booking pattern analysis |
| POST | `/api/ai/campaign-copy` | requireRole | owner, manager | Yes (20/min) | AI copy generation |
| POST | `/api/ai/churn-prediction` | requireRole | owner, manager | Yes (20/min) | Member churn scores |
| POST | `/api/ai/health-score` | requireRole | owner, manager | Yes (20/min) | Member health scores |
| GET | `/api/ai/insights` | ad-hoc | owner, manager, trainer | Yes (20/min) | List AI insights |
| POST | `/api/ai/insights/generate` | ad-hoc | owner, manager | Yes (20/min) | Generate new insights |
| GET | `/api/ai/insights/history` | ad-hoc | owner, manager, trainer | Yes (20/min) | Insight history |
| PUT | `/api/ai/insights/:id/action` | ad-hoc | owner, manager, trainer | Yes (20/min) | Mark insight actioned |
| PUT | `/api/ai/insights/:id/dismiss` | ad-hoc | owner, manager, trainer | Yes (20/min) | Dismiss insight |
| POST | `/api/ai/intake-enrichment` | requireRole | owner, manager | Yes (20/min) | Enrich member intake |
| GET | `/api/ai/recommendations` | requireRole | owner, manager | Yes (20/min) | AI recommendations |
| GET | `/api/ai/revenue-anomaly` | requireRole | owner, manager | Yes (20/min) | Revenue anomaly detection |
| POST | `/api/ai/search` | requireRole | owner, manager | Yes (20/min) | AI-powered search |
| POST | `/api/ai/trainer-summary` | requireRole | owner, manager | Yes (20/min) | Trainer performance summary |
| POST | `/api/ai/waitlist-message` | requireRole | owner, manager | Yes (20/min) | Generate waitlist message |
| POST | `/api/ai/auto-reply` | requireRole | owner, manager | Yes (20/min) | Generate auto-reply |

### Reports (7 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/reports` | ad-hoc | admin, manager (alias bug) | List reports |
| POST | `/api/reports` | ad-hoc | admin, manager (alias bug) | Create report |
| GET | `/api/reports/templates` | ad-hoc | admin, manager (alias bug) | List templates |
| GET | `/api/reports/:id` | ad-hoc | admin, manager (alias bug) | Report detail |
| PUT | `/api/reports/:id` | ad-hoc | admin, manager (alias bug) | Update report |
| DELETE | `/api/reports/:id` | ad-hoc | admin, manager (alias bug) | Delete report |
| POST | `/api/reports/:id/generate` | ad-hoc | admin, manager (alias bug) | Run report |
| POST | `/api/reports/:id/export` | ad-hoc | admin, manager (alias bug) | Export report |
| GET | `/api/reports/:id/exports` | ad-hoc | admin, manager (alias bug) | List exports |
| GET | `/api/reports/exports/:exportId/download` | ad-hoc | admin, manager (alias bug) | Download export |

### Segments (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/segments` | ad-hoc | owner, manager | List smart segments |
| POST | `/api/segments` | ad-hoc | owner, manager | Create segment |
| GET | `/api/segments/:id` | ad-hoc | owner, manager | Segment detail + members |
| PUT | `/api/segments/:id` | ad-hoc | owner, manager | Update segment |
| DELETE | `/api/segments/:id` | ad-hoc | owner, manager | Delete segment |

### Settings (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/settings` | ad-hoc | owner, manager | Studio settings |
| PUT | `/api/settings` | ad-hoc | owner, manager | Update settings |

### Products & Orders (5 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/products` | ad-hoc | owner, manager | List products |
| POST | `/api/products` | ad-hoc | owner, manager | Create product |
| GET | `/api/products/:id` | ad-hoc | owner, manager | Product detail |
| PUT | `/api/products/:id` | ad-hoc | owner, manager | Update product |
| DELETE | `/api/products/:id` | ad-hoc | owner, manager | Delete product |
| GET | `/api/orders` | ad-hoc | owner, manager | List orders |
| GET | `/api/orders/:id` | ad-hoc | owner, manager | Order detail |
| PUT | `/api/orders/:id/status` | ad-hoc | owner, manager | Update order status |
| POST | `/api/orders/:id/ship` | ad-hoc | owner, manager | Create shipping label |
| GET | `/api/orders/:id/tracking` | ad-hoc | owner, manager | Tracking info |
| POST | `/api/shipping/rates` | ad-hoc | owner, manager | Get shipping rates |

### Trainers (5 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/trainers/leaderboard` | ad-hoc | owner, manager | Trainer leaderboard |
| GET | `/api/trainers/performance` | ad-hoc | owner, manager | All trainers performance |
| GET | `/api/trainers/:id/performance` | ad-hoc | owner, manager | Trainer performance detail |
| GET | `/api/trainers/:id/performance/history` | ad-hoc | owner, manager | Historical performance |
| POST | `/api/trainers/:id/performance/summary` | ad-hoc | owner, manager | Generate AI summary |

### Pricing (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/pricing` | requireRole | owner, manager | Price breakdown calc (Glofox) |
| GET | `/api/pricing-simulator` | ad-hoc | owner, manager | List simulations |
| POST | `/api/pricing-simulator` | ad-hoc | owner, manager | Create simulation |
| GET | `/api/pricing-simulator/current-plans` | ad-hoc | owner, manager | Current pricing plans |
| GET | `/api/pricing-simulator/:id` | ad-hoc | owner, manager | Simulation detail |
| PUT | `/api/pricing-simulator/:id` | ad-hoc | owner, manager | Update simulation |
| DELETE | `/api/pricing-simulator/:id` | ad-hoc | owner, manager | Delete simulation |
| POST | `/api/pricing-simulator/:id/analyze` | ad-hoc | owner, manager | AI pricing analysis |
| POST | `/api/pricing-simulator/:id/apply` | ad-hoc | owner, manager | Apply price changes |

### Geofence (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/geofence` | ad-hoc | owner, manager | List geofence locations |
| POST | `/api/geofence` | ad-hoc | owner, manager | Create geofence |
| PUT | `/api/geofence/:id` | ad-hoc | owner, manager | Update geofence |
| DELETE | `/api/geofence/:id` | ad-hoc | owner, manager | Delete geofence |

### Glofox (3 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/glofox/status` | requireRole | owner, manager | Glofox sync status |
| POST | `/api/glofox/sync` | requireRole | owner, manager | Trigger manual sync |
| POST | `/api/glofox/backfill` | requireRole | owner (only) | Full historical backfill |

### Migration (7 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/migration/status` | ad-hoc | owner, manager | Migration status |
| POST | `/api/migration/upload` | ad-hoc | owner, manager | Upload Glofox export |
| POST | `/api/migration/validate` | ad-hoc | owner, manager | Validate data |
| POST | `/api/migration/import` | ad-hoc | owner, manager | Run import |
| GET | `/api/migration/jobs` | ad-hoc | owner, manager | List migration jobs |
| GET | `/api/migration/jobs/:id` | ad-hoc | owner, manager | Job detail |
| POST | `/api/migration/jobs/:id/rollback` | ad-hoc | owner, manager | Rollback migration |
| POST | `/api/migration/wave-assign` | ad-hoc | owner, manager | Assign migration waves |

### SMS (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| POST | `/api/sms/send` | ad-hoc | owner, manager | Send SMS (rate limited 5/min) |

### Email Templates (1 route)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/email-templates` | ad-hoc | owner, manager | List templates |
| POST | `/api/email-templates` | ad-hoc | owner, manager | Create template |
| PUT | `/api/email-templates` | ad-hoc | owner, manager | Update template |

### QR Codes (2 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET | `/api/qr/member/:id` | ad-hoc | owner, manager | Generate member check-in QR |
| GET | `/api/qr/promo/:code` | ad-hoc | owner, manager | Generate promo code QR |

### Cron/Scheduled (3 routes)

| Method | Path | Auth | Role Required | Notes |
|--------|------|------|---------------|-------|
| GET+POST | `/api/cron/waitlist-promote` | cron+auth | owner/admin (alias inconsistency) | Promote waitlist entries |
| POST | `/api/campaigns/process-scheduled` | cron+auth | owner, manager | Send scheduled campaigns |
| POST | `/api/leads/score` | cron+auth | admin, manager (alias bug) | Batch lead scoring |

### Public / Webhook (8 routes)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/leads/capture` | none (rate limited) | Lead capture from public form |
| GET | `/api/unsubscribe/:token` | none (HMAC token) | Validate unsubscribe token |
| POST | `/api/unsubscribe/:token` | none (HMAC token) | Process unsubscribe |
| GET | `/api/openapi` | none | OpenAPI YAML spec |
| POST | `/api/webhooks/stripe` | Stripe signature | Stripe event processing |
| POST | `/api/webhooks/resend` | Svix signature | Email delivery events |
| POST | `/api/webhooks/twilio` | Twilio signature (conditional) | SMS delivery callbacks |
| POST | `/api/webhooks/easypost` | HMAC (conditional) | Shipping tracker updates |
| GET+POST+PUT | `/api/inngest` | Inngest signing key | Background job invocation |

---

## Middleware Analysis

### Next.js Middleware (`src/middleware.ts`)

The middleware runs on every request matched by the config pattern. It:

1. Refreshes the Supabase auth session cookie on every request via `updateSession()`
2. Checks if the path is in the public allowlist
3. For protected paths: validates user via `supabase.auth.getUser()`
4. Returns 401 JSON for unauthenticated API requests
5. Redirects unauthenticated page requests to `/login`

**Public allowlist** (bypasses session check):
- `/login`, `/auth/callback`
- `/api/leads/capture`, `/api/unsubscribe`, `/api/inngest`
- `/api/webhooks/stripe`, `/api/webhooks/resend`, `/api/webhooks/easypost`, `/api/webhooks/twilio`
- `/api/openapi`
- `/api/cron/` (prefix match)

**Gap**: The middleware enforces authentication but not authorization. Role enforcement is entirely delegated to individual route handlers. This means the middleware provides a first-level "is this a logged-in user?" check, but a `"member"` role user who authenticates at the middleware level will get past the middleware check on every protected route — it is then up to each route's individual role check to refuse them. The 26 `requireRole()` routes and ~114 ad-hoc routes all perform their own second-level check correctly (modulo the alias bug in C-1).

**Comment in middleware** (important note about RLS):
```
// TODO(RLS): Phase 2+ tables use `current_setting('app.studio_id')::uuid` in
// RLS policies, but server-side route handlers use a service-role client that
// bypasses RLS entirely.
```

This confirms that multi-tenant isolation is enforced manually in each route, not at the database layer. This is the correct architecture for the current phase but makes the hardcoded STUDIO_ID issue (H-3) a critical multi-tenancy gap.

---

## Authentication Pattern Summary

| Pattern | Count | Description |
|---------|-------|-------------|
| `requireRole()` | 26 | Canonical helper — handles owner/admin alias, returns structured result |
| Ad-hoc getUser + role check | ~114 | Manual implementation — varies in role alias, error format, studio_id derivation |
| Cron secret dual-auth | 3 | Accepts either `x-cron-secret` header or authenticated admin user |
| Public (no auth) | 4 | `/api/leads/capture`, `/api/unsubscribe/*`, `/api/openapi`, `/api/auth/profile`* |
| Webhook signature auth | 4 | `/api/webhooks/*` — Stripe (always), Resend (always), Twilio/EasyPost (conditional) |
| Inngest signing | 1 | `/api/inngest` — relies on SDK/env var |

*`/api/auth/profile` requires authentication but is intentionally public in middleware for sign-up flow.

---

## API Consistency Analysis

### Response Envelope

Consistent: virtually all routes return `{ data: ... }` or `{ error: ... }`. No raw arrays are returned at the top level.

Inconsistencies found:
- `GET /api/members` returns `{ data, total }` (with count)
- `GET /api/bookings` returns `{ data, count }`
- `GET /api/ai/briefing` returns `{ briefing, metrics, timestamp }` (no `data` wrapper)
- `GET /api/ai/recommendations` returns `{ recommendations, generatedAt }` (no `data` wrapper)
- `GET /api/ai/revenue-anomaly` returns `{ anomaly, generatedAt }` (no `data` wrapper)
- Webhook handlers return `{ received: true }` (intentionally different)

### HTTP Method Usage

Mostly REST-compliant. Issues:
- `GET /api/cron/waitlist-promote` has side effects (promotes waitlist entries) — should be POST only
- `PUT /api/email-templates` updates by query parameter rather than path parameter (no `:id` in path)
- `POST /api/campaigns/process-scheduled` is REST-correct for an action, but the endpoint name contains an implementation detail

### URL Naming Conventions

Consistent kebab-case throughout. No camelCase URLs detected.

Minor inconsistencies:
- `check-in` vs `checkin` (only uses `check-in`)
- `pricing-simulator` vs `price-simulator` — intentional, consistent
- `select-winner` (action noun) vs `activate`/`deactivate` (verb) — inconsistent action naming style

### Error Response Format

All routes return `{ error: string }` for errors. No routes return structured error objects with `code`, `field`, or `details`. For validation errors, the response is just `{ error: "field_name is required" }` as a plain string.

### Input Validation

No routes use Zod or any schema validation library. All validation is manual if-checks. Common patterns:
- Required field checks: `if (!field_name) return 400`
- No type coercion validation beyond `parseInt()`
- No array length limits on request body arrays
- No maximum string length enforcement on user input

---

## External Service Integration

### Anthropic (AI)

- **Client**: `lib/ai/client.ts` (singleton Anthropic client)
- **Routes**: 13 endpoints (all rate-limited via in-memory limiter — see C-2)
- **Error handling**: All AI routes have try/catch wrapping with 500 fallback
- **Rate limiting**: 20 requests/minute per user ID — shared bucket across all AI endpoints (see L-2)
- **Timeout**: No explicit timeout configured on Anthropic API calls

### Stripe

- **Client**: `lib/stripe.ts`
- **Webhook**: Signature verification always enforced via `constructWebhookEvent()`
- **Service role client**: Correctly used for webhook processing (no user session available)
- **Events handled**: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`, `payment_intent.succeeded`

### Resend (Email)

- **Client**: `lib/resend.ts`
- **Webhook**: Svix signature verification always enforced
- **Usage**: Campaign sends, waitlist messages, invoices, test emails

### Glofox (Read-Only Integration)

- **Client**: `lib/glofox/client.ts`
- **Routes**: 3 dedicated endpoints + referenced in booking/check-in flows
- **Direction**: Read-only per memory file constraint — write-back functions exist in Inngest but are gated
- **Error handling**: Glofox API errors are caught and surfaced as 502/500 responses

### Twilio (SMS)

- **Client**: `lib/sms/providers/twilio.ts`
- **Routes**: 1 send endpoint (rate-limited 5/min)
- **Webhook**: Signature validation conditional on `TWILIO_AUTH_TOKEN` (see H-1)

### EasyPost (Shipping)

- **Webhook**: HMAC verification conditional on `EASYPOST_WEBHOOK_SECRET` (see H-1)
- **Client**: Used in `orders/:id/ship` for label creation

### Inngest (Background Jobs)

- **Endpoint**: `GET+POST+PUT /api/inngest`
- **Functions**: 19 registered functions (cron jobs + event-driven)
- **Security**: Signing key via environment variable (not enforced in code — see H-2)

---

## Missing Routes

The following UI features visible in the project structure have no corresponding API backing:

1. **Trainer profile management** — No `GET/PUT /api/trainers/:id` or trainer CRUD endpoints. The `trainers/` routes only handle performance metrics and leaderboard. Trainer profiles appear to be managed through `staff/` endpoints, creating a semantic gap.

2. **Promo code CRUD** — No `GET/POST/PUT/DELETE /api/promo-codes` or `/api/trainers/:id/promo-codes` endpoint. The QR generation for promo codes (`/api/qr/promo/:code`) exists, but there is no API to create, list, or manage promo codes themselves.

3. **Waitlist management** — No `GET /api/waitlist` or `GET /api/classes/:id/waitlist` endpoint. The cron/waitlist-promote endpoint exists but there is no way to view or manage waitlist entries via the API.

4. **Guest pass management** — No API for the guest pass system (QR/link invite flow, conversion tracking) mentioned in edge-case policies.

5. **Gift card management** — No `GET/POST /api/gift-cards` endpoint despite gift cards being a documented revenue stream.

6. **Check-in history** — No `GET /api/check-ins` or `GET /api/members/:id/check-ins` endpoint for viewing historical check-in records.

7. **Activity log** — No `GET /api/activity-log` endpoint. The activity log table is written to by many routes but cannot be read via the API.

---

## Duplicate / Redundant Routes

1. **`GET /api/cron/waitlist-promote` and `POST /api/cron/waitlist-promote`**: Identical behavior — GET delegates to POST. The GET variant should be removed.

2. **`GET /api/analytics/summary` vs `POST /api/analytics/snapshot`**: Both aggregate business metrics but via different mechanisms (live query vs write-to-cache). Their relationship and which the UI should prefer is unclear from the API surface alone.

3. **`POST /api/ai/trainer-summary` and `GET /api/trainers/:id/performance/summary`**: Both produce trainer summaries. The AI route generates fresh LLM content; the trainer route computes metrics. Their distinction is not obvious from the URL pattern.

---

## Rate Limiting Coverage

| Endpoint Group | Rate Limit | Scope | Effective in Prod? |
|---------------|-----------|-------|-------------------|
| All AI endpoints | 20/min | Per user ID | No (in-memory) |
| `/api/leads/capture` | 10/min | Per IP | No (in-memory) |
| `/api/sms/send` | 5/min | Per user ID | No (in-memory) |
| All other 140+ routes | None | — | N/A |

**Notable gaps**: The `migration/import` endpoint (uploads and processes large Glofox data files), the `payroll/calculate` endpoint (expensive aggregation), and the Anthropic-calling `pricing-simulator/analyze` endpoint have no rate limiting at all.

---

## Diagram

See `.audit/diagrams/api-surface.mmd` for the API flow diagram grouped by resource domain, middleware chain, and authentication boundaries.

---

## Recommendations (Priority Order)

1. **Fix role alias mismatch (C-1)**: Replace all `["admin", "manager"]` role arrays in ad-hoc routes with `["owner", "manager"]`. Alternatively, add `"owner"` to the `ROLE_ALIASES` map and document it as the canonical value going forward. This is a one-day fix.

2. **Replace in-memory rate limiter (C-2)**: Before any production AI launch, integrate Upstash Redis or Netlify Blobs as the rate limiter backend. The current limiter provides no protection in serverless deployments.

3. **Harden webhook validation (H-1)**: Make `EASYPOST_WEBHOOK_SECRET` and `TWILIO_AUTH_TOKEN` required environment variables. Add startup assertions. Remove the "development mode" bypass from EasyPost.

4. **Confirm Inngest signing key (H-2)**: Add `INNGEST_SIGNING_KEY` to the environment documentation and add a log warning at startup if it is absent.

5. **Migrate ad-hoc routes to `requireRole()` (M-1)**: Systematic migration would eliminate ~114 duplicated auth implementations and make all routes use the alias-aware helper. Can be done incrementally — start with the highest-sensitivity routes (payroll, reports, migration).

6. **Harden hardcoded STUDIO_ID (H-3)**: Replace all 43 `const STUDIO_ID = "11111111..."` constants with `getStudioId(profile)` derived from the authenticated user's profile. This is the pre-requisite for multi-tenant operation.

7. **Add Content-Security-Policy header (M-5)**: Add a CSP header to `netlify.toml`. At minimum: `default-src 'self'; script-src 'self'; connect-src 'self' *.supabase.co`.

8. **Add HSTS header (M-5)**: `Strict-Transport-Security: max-age=63072000; includeSubDomains`.

9. **Remove GET side effect from cron endpoint (L-5)**: Delete the `GET` export from `/api/cron/waitlist-promote`. Keep only `POST`.

10. **Expand OpenAPI spec (H-4)**: Generate the spec from route handler comments rather than maintaining it manually. At minimum, document all AI endpoints and all webhook endpoints.

11. **Add missing routes**: Promo code CRUD, waitlist listing, gift card management, and check-in history are needed to make the admin UI fully API-backed.
