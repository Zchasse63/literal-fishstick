# Security Audit Report

**Agent**: security
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Routes examined**: 148 API route handlers, all webhook handlers, middleware, auth infrastructure
- **Files examined**: `lib/auth/require-role.ts`, `lib/auth/get-studio-id.ts`, `middleware.ts`, `contexts/auth-context.tsx`, `lib/anthropic.ts` (AI search/SQL generation), all webhook routes, `lib/rate-limit.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `.gitignore`, `netlify.toml`, `next.config.ts`, `.github/workflows/ci.yml`, `e2e/.auth/*.json`, selected API routes across all domains, SQL migration scripts
- **Auth infrastructure**: Supabase Auth (magic link / passwordless), `@supabase/ssr` cookie management
- **External integrations**: Stripe, Resend (Svix), Twilio, EasyPost, Inngest, Anthropic

> **Important — Scope of this report**: This is heuristic static analysis of the source code. It is not a penetration test, dynamic application scan, or formal security audit. Findings reflect code-level patterns and known vulnerability classes. Recommended complementary tools: **Semgrep** (static analysis), **Snyk** (dependency CVEs), **OWASP ZAP** (runtime scanning), **npm audit** (dependency vulnerabilities). This analysis should be treated as a starting point, not a complete security posture assessment.

---

## Executive Summary

Meridian's security architecture has a well-designed core: Supabase Auth with magic-link/passwordless authentication, a canonical `requireRole()` helper with role alias normalization, HMAC-signed unsubscribe tokens with timing-safe comparison, and strong Stripe and Resend webhook verification. However, the surface has grown substantially faster than the security controls have been applied uniformly. The critical issues center on two structural fractures: a role alias mismatch that silently denies the "owner" role from sensitive endpoints, and committed JWT credentials that must be treated as compromised. Three webhook handlers skip signature verification when environment variables are absent, and the AI natural language search executes AI-generated SQL with incomplete guardrails against cross-tenant data exfiltration. The in-memory rate limiter provides no protection in the Netlify serverless environment, leaving AI endpoints unbounded against cost exhaustion.

For a current single-tenant deployment these risks are partially mitigated by the fact that only trusted internal users have accounts. But several findings are pre-conditions for the SaaS multi-tenant expansion and must be resolved before a second studio is onboarded.

**Findings summary**: 3 Critical, 7 High, 8 Medium, 4 Low.

---

## Security Boundary Diagram

See `.audit/diagrams/security.mmd`.

Color coding: green = adequately protected, yellow = partially protected / conditional, red = protection gap identified.

Key observations from the diagram:
- The middleware auth boundary covers all non-public routes, but enforcement quality varies between canonical (58 routes, green) and ad-hoc (90 routes, yellow/red)
- RLS policies exist in SQL migrations but are never triggered because the `app.studio_id` session variable is never set and all API routes use the service-role client
- Two webhook endpoints (Twilio, EasyPost) have conditional verification drawn in red because the condition is the absence of a required env var, not an explicit bypass decision

---

## Findings

### CRITICAL

---

#### SEC-C1: Supabase JWT Credentials Committed to Repository

**File**: `apps/web/e2e/.auth/admin.json`, `apps/web/e2e/.auth/employee.json`

These files contain live Supabase JWT access tokens and refresh tokens for real test accounts. The admin file contains a full access token and refresh token (`iealmrlfxkby`) for `meridian-e2e-admin@test.meridian.app`. The tokens were issued 2026-03-22. While access tokens expire after 3600 seconds, the refresh token remains valid until explicitly revoked in the Supabase dashboard.

The root `.gitignore` does not exclude `e2e/.auth/`. There is no `.gitignore` inside `e2e/.auth/`. Playwright's documentation explicitly recommends excluding these files.

Session cookie security attributes from the committed files:
- `httpOnly: false` — accessible to JavaScript, vulnerable if XSS occurs
- `secure: false` — can be sent over non-HTTPS
- `sameSite: Lax` — provides some CSRF protection but combined with the above is insufficient

**Impact**: Anyone with repository read access holds a refresh token that can generate fresh access tokens at any time with no expiry enforcement. The E2E admin account has admin/owner-level roles.

**Severity**: CRITICAL — active credential exposure in version control.

**Fix**:
1. Immediately revoke the session in the Supabase Auth dashboard: project `rhdmiyttafsbfuflnjza` > Authentication > Users > find the E2E admin and employee accounts > revoke all sessions.
2. Add `e2e/.auth/` to root `.gitignore`.
3. Consider rotating the Supabase service role key as a precaution given the project reference is now public via the token payload.

---

#### SEC-C2: Role Alias Mismatch Causes Silent Authorization Bypass for "owner" Accounts

**Files**: Approximately 20 routes including `api/leads/route.ts`, `api/leads/[id]/route.ts`, `api/leads/[id]/activity/route.ts`, `api/leads/[id]/convert/route.ts`, `api/content/route.ts`, `api/content/[id]/route.ts`, `api/automations/route.ts`, `api/automations/[id]/activate/route.ts`, `api/automations/[id]/deactivate/route.ts`, `api/reports/[id]/export/route.ts`, `api/reports/[id]/generate/route.ts`, `api/sms/send/route.ts`

The canonical `requireRole()` helper normalizes "owner" and "admin" as equivalent via `ROLE_ALIASES`. Ad-hoc routes check `ALLOWED_ROLES = ["admin", "manager"]`, omitting "owner" entirely:

```typescript
// Approximately 20 routes
const ALLOWED_ROLES = ["admin", "manager"];
if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

A user created with the canonical "owner" role will be silently refused from: listing and managing leads, converting leads to members, reading and modifying content posts, activating automations, exporting financial reports, generating PDFs, and sending SMS messages.

The SMS endpoint (`api/sms/send`) accepts an arbitrary E.164 `to` number. It is blocked for "owner" accounts but accessible to legacy "admin" accounts — the opposite of the intended hierarchy.

**Severity**: CRITICAL — authorization logic is inverted for the highest-privilege role.

**Fix**: Replace all instances of `ALLOWED_ROLES = ["admin", "manager"]` with `["owner", "manager"]`, or migrate affected routes to use `requireRole(["owner", "manager"])` which handles aliasing automatically.

---

#### SEC-C3: AI Natural Language Search Executes AI-Generated SQL With Bypassable Studio Isolation

**Files**: `apps/web/src/app/api/ai/search/route.ts`, `apps/web/src/lib/anthropic.ts` (translateToSQL function)

The `/api/ai/search` endpoint accepts natural-language queries from authenticated owner/manager users, passes them to Claude to generate a SQL SELECT statement, and executes the generated SQL via a Supabase RPC function `execute_readonly_sql`. Several code-level safeguards are present:

- Rejects non-SELECT statements (`parsed.sql.trim().toUpperCase().startsWith("SELECT")`)
- Blocks forbidden keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `EXEC`, `EXECUTE`, `GRANT`, `REVOKE`)
- Checks that the studio_id UUID appears in the generated SQL

However, the studio isolation guarantee relies entirely on the prompt instruction and a string presence check. These are bypassable through prompt injection. A user could submit a query constructed to include the correct studio_id string while also querying other tenants via JOIN or UNION operations. The presence check `if (!parsed.sql.includes(studio_id))` confirms the string exists but not that it is the only WHERE clause filter.

The forbidden keyword check uses `regex.test(parsed.sql.slice(6))` which skips only the first 6 characters. Subquery syntax (`SELECT (SELECT * FROM other_tenant_data)`) passes all checks.

No LIMIT is enforced at the code level. The prompt instructs Claude to limit to 50 rows, but this is not verified or enforced before execution. A query returning unbounded rows could exhaust serverless memory.

The definition of `execute_readonly_sql` was not found in the scripts directory, so its server-side security properties are unknown.

**Severity**: CRITICAL in a multi-tenant context. Current single-tenant deployment prevents cross-tenant leakage (only one studio exists), but this is a pre-condition blocking multi-tenant onboarding.

**Fix**:
1. Rewrite `execute_readonly_sql` as a Postgres function that accepts a mandatory `p_studio_id UUID` parameter and enforces it via a CTE before execution, preventing cross-tenant queries regardless of what SQL is passed.
2. After SQL generation, inspect for LIMIT clause; append `LIMIT 100` if absent.
3. Sanitize user input before passing to the AI prompt: strip known injection patterns.

---

### HIGH

---

#### SEC-H1: Two Webhook Handlers Skip Verification When Environment Variables Are Absent

**Files**: `apps/web/src/app/api/webhooks/easypost/route.ts`, `apps/web/src/app/api/webhooks/twilio/route.ts`

Both handlers gate signature verification on whether the environment variable is set:

EasyPost (`easypost/route.ts`):
```typescript
const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET
if (webhookSecret) {
  // ...verify HMAC...
  return await handleEvent(event)
}
// No secret configured -- parse body directly (development mode)
const event = await request.json()
return await handleEvent(event)   // executes with no verification
```

Twilio (`twilio/route.ts`):
```typescript
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (authToken) {
  // ...validate...
}
// Falls through to handler if no auth token set
```

The EasyPost handler writes to `shipping_labels` and `orders` tables. The Twilio handler logs inbound SMS. Both endpoints are public routes (bypass session auth). In staging environments, preview deployments, or any deployment missing the env vars, an attacker can send arbitrary payloads and manipulate order shipping status or forge delivery notifications.

The Stripe and Resend handlers do not have this flaw.

**Severity**: HIGH — exploitable in under-configured deployments without authentication.

**Fix**: Remove the conditional pattern. Require the secret at startup:
```typescript
const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('EASYPOST_WEBHOOK_SECRET is required');
}
```

---

#### SEC-H2: Inngest Endpoint Authentication Is Implicit and Unenforced

**File**: `apps/web/src/app/api/inngest/route.ts`

```typescript
export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

The Inngest SDK reads `INNGEST_SIGNING_KEY` automatically from the environment. This variable is not in `.env.local`, not documented, and not validated at startup. The middleware lists `/api/inngest` as public with the comment "verified via signing key" — but that verification only occurs if the key is configured.

Inngest functions include 19 background operations: waitlist promotion, automation enrollment, campaign sending, health score updates, and AI briefing generation. If `INNGEST_SIGNING_KEY` is absent, all 19 background jobs can be triggered externally.

**Severity**: HIGH — all background jobs could be triggered externally if the key is not set in production.

**Fix**: Add a startup assertion:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.INNGEST_SIGNING_KEY) {
  throw new Error('INNGEST_SIGNING_KEY is required in production');
}
```

---

#### SEC-H3: In-Memory Rate Limiter Is Non-Functional in Netlify Serverless

**File**: `apps/web/src/lib/rate-limit.ts`

The rate limiter uses a module-level Map. In Netlify serverless Functions, each invocation runs in an isolated V8 isolate. Module-level state does not persist between requests. The limiter's own comment acknowledges this:

> "Suitable for single-instance deployments. For multi-instance / serverless, replace with a Redis-backed implementation."

This limiter is applied to all 13 AI endpoints (20 requests/minute per user), the SMS send endpoint (5 requests/minute), and the lead capture endpoint (10 requests/minute by IP). All limits are effectively 0 in production.

An authenticated user can invoke Anthropic API endpoints thousands of times per minute. Each call costs real money. A runaway client or compromised credential could exhaust the monthly AI budget in minutes.

**Severity**: HIGH — unlimited AI API cost exposure in production.

**Fix**: Replace with Upstash Redis (`@upstash/ratelimit`) or Netlify Blobs for persistent rate limit counters.

---

#### SEC-H4: Auth Session Cookie Security Attributes Are Unverified for Production

**Finding**: The committed E2E auth files reveal session cookie attributes set by `@supabase/ssr` in the test environment: `httpOnly: false`, `secure: false`, `sameSite: Lax`. The `lib/supabase/middleware.ts` `setAll` implementation passes options through from the Supabase SDK without enforcing security-critical attributes:

```typescript
cookiesToSet.forEach(({ name, value, options }) =>
  supabaseResponse.cookies.set(name, value, options)   // options from SDK, not overridden
);
```

`httpOnly: false` means the session cookie is readable by JavaScript — any XSS vulnerability leads directly to session theft. `secure: false` allows transmission over non-HTTPS.

Supabase may set these correctly in production (the test values reflect localhost), but there is no code-level assertion confirming this.

**Severity**: HIGH — if `httpOnly: false` carries to production, session theft via XSS becomes trivial.

**Fix**: Override cookie options in `setAll` to explicitly set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'`.

---

#### SEC-H5: Client Auth Context Uses `getSession()` Instead of `getUser()`

**File**: `apps/web/src/contexts/auth-context.tsx` (line 65)

```typescript
supabase.auth.getSession().then(({ data: { session: s } }) => {
  setSession(s)
  setUser(s?.user ?? null)
```

Supabase explicitly recommends using `getUser()` (validates JWT against the Supabase server) rather than `getSession()` (reads from local storage without revalidation). A revoked token would still show the user as authenticated in the UI until the next server-validated request.

**Severity**: HIGH — the UI displays incorrect auth state after session revocation; risk of misuse in future code.

**Fix**: Replace `supabase.auth.getSession()` with `supabase.auth.getUser()` in `auth-context.tsx`.

---

#### SEC-H6: No `.env.example` File — Required Secrets Are Undocumented

**Finding**: No `.env.example` file exists. The CI workflow documents a subset of test values but is not authoritative. The following security-critical variables have no documentation:
- `EASYPOST_WEBHOOK_SECRET` — conditionally used (enables SEC-H1 bypass if absent)
- `TWILIO_AUTH_TOKEN` — conditionally used (enables SEC-H1 bypass if absent)
- `INNGEST_SIGNING_KEY` — implicitly required (enables SEC-H2 if absent)
- `UNSUBSCRIBE_SECRET` — required (correctly throws if missing)
- `CRON_SECRET` — referenced by cron endpoints
- `GLOFOX_API_KEY`, `GLOFOX_API_TOKEN`, `GLOFOX_BRANCH_ID`, `GLOFOX_STUDIO_ID`

**Severity**: HIGH — the absence of documentation directly enables the conditional verification bypasses in SEC-H1.

**Fix**: Create `apps/web/.env.example` with all required variables, placeholder values, and comments marking security-critical ones.

---

#### SEC-H7: Unsubscribe HMAC Token Has No Expiration Check

**File**: `apps/web/src/app/api/unsubscribe/[token]/route.ts`

The token format includes a timestamp: `${memberId}:${studioId}:${timestamp}:${hmac}`. The HMAC verification is correctly implemented with timing-safe comparison. However, the `verifyHmac` function does not validate the timestamp against a maximum age — once issued, an unsubscribe link is valid forever.

**Impact**: A link shared in a forwarded email could be clicked years later. There is no window-based migration path for `UNSUBSCRIBE_SECRET` rotation.

**Severity**: HIGH — non-expiring authentication tokens are a security anti-pattern.

**Fix**: Add a maximum age check:
```typescript
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const tokenAge = Date.now() - parseInt(timestamp, 10);
if (isNaN(tokenAge) || tokenAge > MAX_AGE_MS) return false;
```

---

### MEDIUM

---

#### SEC-M1: RLS Policies Are Defined But Never Active — `app.studio_id` Is Never Set

**Files**: `scripts/phase2-migration.sql` (lines 401-452), `apps/web/src/middleware.ts` (lines 35-40)

The Phase 2 migration defines RLS policies on 11 tables using `current_setting('app.studio_id')::uuid`. The middleware contains an explicit TODO acknowledging these policies are never triggered because all API routes use the service-role client that bypasses RLS:

```
// TODO(RLS): Phase 2+ tables use current_setting('app.studio_id')::uuid in
// RLS policies, but server-side route handlers use a service-role client that
// bypasses RLS entirely.
```

All tenant isolation is currently enforced by manual `.eq("studio_id", studioId)` filters in application code. The RLS policies exist but provide zero protection.

**Severity**: MEDIUM now; blocking before multi-tenant Phase 5.

**Fix**: Before Phase 5 client-side access, implement `set_config('app.studio_id', ...)` before each query, or rewrite policies to use `auth.uid()` with a profile join.

---

#### SEC-M2: No Explicit CORS Policy

**Finding**: No CORS configuration was found in `next.config.ts`, `netlify.toml`, or any route handler. Next.js defaults to same-origin only for API routes. Public endpoints (`/api/leads/capture` — designed as an external form embed, `/api/openapi` — intended for third-party API consumers) require cross-origin access but have no `Access-Control-Allow-Origin` headers.

**Severity**: MEDIUM — restrictive by default (good), but undocumented and likely blocking intended use cases.

**Fix**: Add explicit CORS headers to routes designed for cross-origin access.

---

#### SEC-M3: Missing Content-Security-Policy and HSTS Headers

**File**: `netlify.toml`

Present: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

Missing:
- `Content-Security-Policy` — no XSS mitigation at the browser level
- `Strict-Transport-Security` — no HTTPS enforcement

**Severity**: MEDIUM — missing defense-in-depth controls.

**Fix**:
```toml
Strict-Transport-Security = "max-age=63072000; includeSubDomains"
Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co"
```

---

#### SEC-M4: Client-Side Role Flags Not Clearly Marked as UI-Only

**File**: `apps/web/src/contexts/auth-context.tsx`

The `isAdmin` and `isTrainer` booleans are computed client-side from `profile.roles`. These should only control UI rendering, never security decisions. There is no comment documenting this constraint, risking future misuse by developers adding new features.

**Severity**: MEDIUM — UI-only impact currently; risk is future misuse.

**Fix**: Add explicit comment: "These flags control UI display only. Never use them for authorization in API routes or server code."

---

#### SEC-M5: Hardcoded Studio ID in 43 API Routes Creates Multi-Tenant Data Exposure Risk

**Pattern**: `const STUDIO_ID = "11111111-1111-1111-1111-111111111111"` appears in 43 of 148 routes. Confirmed in `api/sms/send/route.ts`, `api/ai/auto-reply/route.ts`, and many others.

Zero impact in current single-tenant deployment. When a second studio is onboarded, any authenticated user from Studio B can trigger actions against Studio A's data context through these 43 routes.

**Severity**: MEDIUM — blocking for multi-tenancy.

**Fix**: Migrate all 43 routes to use `getStudioId(profile)` resolved from the authenticated user's session, or migrate them to use `requireRole()` which already returns `studioId`.

---

#### SEC-M6: Chart Component `dangerouslySetInnerHTML` — Verify Content Source Remains Static

**File**: `apps/web/src/components/ui/chart.tsx` (line 83)

The shadcn chart component uses `dangerouslySetInnerHTML` to inject CSS custom properties. The `id`, `key`, and `color` values come from `ChartConfig` props. Based on current usage, these are derived from aggregated numeric data and static CSS color strings — not user-supplied text.

The risk is low now but will increase as charting expands to include user-named data series.

**Severity**: MEDIUM — currently safe; risk is future expansion.

**Fix**: Add CSS identifier sanitization on `id`, `key`, and `color` values before injection: `value.replace(/[^a-zA-Z0-9#(),. %-]/g, '')`.

---

#### SEC-M7: Cron Secret Header Format Inconsistency

**Finding**: `api/cron/waitlist-promote` and `api/campaigns/process-scheduled` use `x-cron-secret`. `api/leads/score` uses `Authorization: Bearer ${cronSecret}`. Both check the same `CRON_SECRET` variable, so there is no security gap. But monitoring tools cannot use a single invocation pattern.

**Severity**: MEDIUM — consistency issue, not a security gap.

**Fix**: Standardize on `x-cron-secret` across all cron endpoints.

---

#### SEC-M8: `GET /api/content` Returns Unpublished Drafts to Any Authenticated User

**File**: `apps/web/src/app/api/content/route.ts`

The GET handler authenticates the user but applies no role restriction. Any authenticated user (including future "member" role accounts) can list all content posts including drafts where `is_published: false`. The POST handler correctly restricts creation to staff roles.

**Severity**: MEDIUM — exposes internal draft content to members when Phase 5 member accounts are added.

**Fix**: Add a role check to `GET /api/content`. Return only `is_published: true` posts for member-level accounts.

---

### LOW

---

#### SEC-L1: No Dependency Vulnerability Scanning in CI

**File**: `.github/workflows/ci.yml`

The CI pipeline runs lint, type-check, test, and build but does not include `npm audit` or any third-party scanner. No Dependabot configuration exists. Notable dependencies warranting monitoring: `handlebars ^4.7.8` (historical prototype pollution in older versions).

**Severity**: LOW — no known CVEs in current dependencies.

**Fix**: Add `npm audit --audit-level=high` to CI. Add `.github/dependabot.yml` for `npm`.

---

#### SEC-L2: Service Role Key Used Without Scope Limiting in Webhook and Inngest Handlers

**Files**: `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/lib/inngest/helpers.ts`

Both use `SUPABASE_SERVICE_ROLE_KEY` to bypass all RLS. This is architecturally necessary for webhook handlers and background jobs. However, if any handler omits a `studio_id` filter due to a bug, the service-role client will return cross-tenant data with no safety net.

**Severity**: LOW — no active vulnerability; defense-in-depth concern.

**Fix**: Consider a restricted Postgres role with access limited to specific tables, used for webhook processing.

---

#### SEC-L3: Raw Database Error Messages Returned to API Clients

**Pattern**: Multiple routes return `error.message` directly from Supabase error objects:

```typescript
return NextResponse.json({ error: error.message }, { status: 500 });
```

Supabase error messages can include table names, column names, and constraint names. This leaks schema information useful for reconnaissance.

**Severity**: LOW — schema information is not a direct vulnerability.

**Fix**: Log `error.message` server-side; return a generic message to clients for 500-series errors.

---

#### SEC-L4: Auth Context Hardcodes Fallback Studio ID in Client

**File**: `apps/web/src/contexts/auth-context.tsx` (line 49)

```typescript
const studioId = profile?.studio_id ?? '11111111-1111-1111-1111-111111111111'
```

Creates a race condition during initial page load where studio-scoped API calls might fire before the profile is loaded, using the wrong studio ID.

**Severity**: LOW — cosmetic in single-tenant; no security impact currently.

**Fix**: Delay studio-scoped API calls until `loading === false && profile !== null`.

---

## Positive Security Findings

The following controls were implemented correctly and should be maintained:

- **Stripe webhook verification**: Always verifies `stripe-signature`. No conditional bypass.
- **Resend (Svix) webhook verification**: Always verifies using Svix headers. No conditional bypass.
- **Unsubscribe HMAC token**: Uses `crypto.timingSafeEqual` (prevents timing attacks). Well-formed token structure.
- **Gift card code generation**: Uses `crypto.randomInt` (cryptographically secure PRNG).
- **Password handling**: No password hashing exists — correctly delegates all auth to Supabase Auth (magic link / passwordless). No passwords stored.
- **Parameterized queries**: All Supabase ORM queries use the query builder with parameterized values. No string concatenation in SQL construction outside the AI search path.
- **Input validation**: Lead capture validates email format, honeypot, and studio token. SMS validates E.164 format. Many routes validate required fields and types.
- **requireRole helper**: Well-designed with role alias normalization. Routes using it get consistent auth with correct "owner"/"admin" alias handling.
- **Server-side auth via `getUser()`**: All 148 API routes use `supabase.auth.getUser()` which validates against the Supabase server.
- **QR check-in tokens**: Tokens stored in DB, matched with both token value and member ID. No predictable patterns.

---

## Remediation Priority

| Priority | ID | Finding | Effort |
|---|---|---|---|
| P0 | SEC-C1 | Revoke committed JWT credentials immediately | Minutes (Supabase dashboard) |
| P0 | SEC-C2 | Fix role alias mismatch — add "owner" to ALLOWED_ROLES in ~20 routes | Low |
| P1 | SEC-H1 | Make EasyPost and Twilio webhook secrets required, fail hard if absent | Low |
| P1 | SEC-H2 | Document and enforce INNGEST_SIGNING_KEY in production | Low |
| P1 | SEC-H6 | Create .env.example with all required variables | Low |
| P1 | SEC-H5 | Replace getSession() with getUser() in auth context | Low |
| P2 | SEC-H3 | Replace in-memory rate limiter with Upstash Redis | Medium |
| P2 | SEC-H4 | Verify session cookie httpOnly and secure attributes in production | Low |
| P2 | SEC-H7 | Add timestamp expiration check to unsubscribe token verification | Low |
| P2 | SEC-C3 | Harden execute_readonly_sql with server-enforced studio_id parameter | Medium |
| P3 | SEC-M1 | Implement set_config before Phase 5 client-side access | High |
| P3 | SEC-M3 | Add CSP and HSTS headers to netlify.toml | Low |
| P3 | SEC-M5 | Migrate 43 hardcoded STUDIO_ID constants to getStudioId(profile) | Medium |
| P3 | SEC-M8 | Add role check to GET /api/content to gate draft visibility | Low |
| P4 | SEC-L1 | Add npm audit to CI pipeline; add Dependabot config | Low |
| P4 | SEC-L3 | Normalize error responses to not leak internal error messages | Low |

---

## Recommended Complementary Tools

This report is based on static heuristic analysis. The following tools should be used to extend coverage:

- **Semgrep** (https://semgrep.dev/): Static analysis with security-focused rules for TypeScript/Next.js. `semgrep --config=auto apps/web/src`
- **Snyk** (https://snyk.io/): Dependency vulnerability scanning with ongoing monitoring. More accurate than npm audit for transitive dependencies.
- **OWASP ZAP** (https://www.zaproxy.org/): Dynamic application security testing. Run against a staging deployment to discover runtime issues not visible in static analysis.
- **npm audit**: Built-in dependency check. `npm audit --audit-level=high` in CI before deployment.
- **Supabase Security Advisor**: Built-in dashboard tool checking for RLS policy gaps, missing indexes, and exposed functions.
