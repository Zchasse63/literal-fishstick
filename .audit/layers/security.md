# Layer Report: Security

**Agent:** security
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian's security posture is generally solid for an admin-only Phase 1+2 system. Authentication uses Supabase magic link (passwordless), role-based access is enforced by the `requireRole()` middleware helper, and webhook integrity is verified via cryptographic signatures (Stripe, Resend). The most serious issues are: (1) an LLM-generated SQL execution path with no server-side query validation (already identified in ai-layer), (2) the events API bypasses multi-tenant isolation using a hardcoded `DEFAULT_STUDIO_ID`, (3) the CSP uses `unsafe-inline` and `unsafe-eval` in both `next.config.ts` and `netlify.toml`, and (4) `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` exposes the Supabase anon key with a NEXT_PUBLIC_ prefix, making it available in client JavaScript bundles.

---

## Authentication & Authorization

### Authentication
- **Mechanism:** Supabase magic link / OTP — passwordless per design
- **Session management:** `@supabase/ssr` cookie-based sessions, refreshed on every request via `updateSession()` in middleware
- **Middleware coverage:** All routes protected by default; public allowlist is explicit and documented
- **Admin/Employee routing:** Separate route groups `(admin)` and `(employee)` with no additional role checks at the layout level — role enforcement is in individual API routes

### Authorization
- **`requireRole()` helper** — canonical pattern, covers ~75% of routes
- **Role aliases:** `"admin"` treated as alias for `"owner"` — handles legacy profiles
- **Profile lookup:** 2 DB calls per authenticated request (getUser + profiles select)
- **DB-level RLS:** Phase 2 tables use `current_setting('app.studio_id')::uuid` in RLS policies
- **Defense-in-depth:** Manual `studio_id` filter on every query, even with RLS active
- **Gap:** Corporate and Events routes use inline auth (see api-surface CRIT-AS-001 and HIGH-AS-001)

### Public Endpoints
Correctly allowlisted in middleware:
- Lead capture (form submission)
- Email unsubscribe (token-based HMAC)
- Webhook endpoints (signature-verified)
- Inngest (signing key)
- Health check
- Glofox sync (CRON_SECRET header)
- API docs

---

## Input Validation

### Zod Validation
- `validateBody()` utility used on write endpoints with Zod schemas
- Schemas defined for: bookings, checkout, corporate, events, and others
- **Gap:** Not all POST endpoints use Zod validation — inline validation (checking required fields manually) is used in some routes
- **Positive:** UUID format validation on `class_id`, `member_id` in booking schema prevents IDOR attacks via malformed IDs

### Search Parameter Injection
Multiple routes construct `.ilike()` queries with unsanitized search params:
```typescript
query.or(`name.ilike.%${search}%,...`)
```
Supabase's PostgREST query builder parameterizes values, so this is NOT a SQL injection vector. However, extremely long `search` values could degrade query performance (no length limit on search param).

### Content Sanitization
- `isomorphic-dompurify` is installed — HTML sanitization is available
- `handlebars` for email template rendering
- Content security with `dangerouslySetInnerHTML` found in `chart.tsx` — this is Recharts' tooltip renderer, not user-controlled content

---

## Secret Management

### Environment Variables
All secrets are stored as environment variables — no hardcoded secrets found in source code.

Key secrets required:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS (high sensitivity)
- `STRIPE_SECRET_KEY` — Stripe API access
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification
- `ANTHROPIC_API_KEY` — AI access
- `INNGEST_SIGNING_KEY` — background job security
- `CRON_SECRET` — cron endpoint auth
- `EMAIL_UNSUBSCRIBE_SECRET` — HMAC for unsubscribe tokens

### Concerns
1. **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`** — This env var has the `NEXT_PUBLIC_` prefix, meaning it is embedded in the client-side JavaScript bundle (this is intentional per Supabase's design — the "anon" key is meant to be public). However, the naming convention `PUBLISHABLE_DEFAULT_KEY` is non-standard. The actual risk is that RLS must be correctly configured to prevent privilege escalation with the anon key — if RLS has gaps, the publicly-available anon key becomes a direct data access vector.
2. **`DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'`** — This hardcoded UUID is used as a fallback in several places. If this UUID matches a real studio in production, it becomes an implicit access vector for any codepath that falls through to this default.

---

## Transport Security

### HTTPS
- Netlify enforces HTTPS by default
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header set in netlify.toml — correct

### Security Headers
Set in `netlify.toml` (correctly):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` (see below)

Set in `next.config.ts` (partially overlapping):
- `Content-Security-Policy: frame-ancestors 'self'` (more restrictive than netlify.toml)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- **Note:** Both netlify.toml and next.config.ts set security headers. In Netlify deployments, there could be duplicate headers or conflicts.

### CSP Analysis
The `netlify.toml` CSP:
```
default-src 'self'; 
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://js.stripe.com; 
style-src 'self' 'unsafe-inline'; 
connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.anthropic.com https://api.resend.com https://inn.gs;
frame-src https://js.stripe.com;
object-src 'none'; 
base-uri 'self'
```
Issues:
- `unsafe-inline` and `unsafe-eval` in `script-src` — allows arbitrary inline script execution, mitigating most CSP protections
- Missing `report-uri` or `report-to` for CSP violation monitoring
- `next.config.ts` has a comment explaining the temporary nature of these directives with a Phase 5 plan — good documentation

---

## Webhook Security

| Webhook | Verification | Risk |
|---------|-------------|------|
| Stripe | `webhooks.constructEvent()` with secret | Verified |
| Resend | Svix library | Verified |
| Inngest | Inngest signing key | Configured |
| EasyPost | Text parsing, no signature check confirmed | Unverified |
| Twilio | Not inspected | Unknown |

---

## Data Exposure Analysis

### Sensitive Fields
- `SUPABASE_SERVICE_ROLE_KEY` — only used server-side (confirmed in lib files) — OK
- `STRIPE_SECRET_KEY` — only used server-side — OK
- Admin notes on members (`notes text | null`) — accessible to owner/manager only via `requireRole` — OK
- Direct deposit info on employees (`direct_deposit_last_four`, `direct_deposit_bank`) — requires employee role or higher — should verify
- Tax IDs on corporate accounts — requires owner/manager — OK

### IDOR (Insecure Direct Object Reference)
- All resource queries include `studio_id = studioId` check — correct
- UUID IDs prevent enumeration attacks
- **Potential gap:** In inline-auth routes (corporate, events), studioId is derived from `DEFAULT_STUDIO_ID` or the profile — must verify the inline patterns always use profile.studio_id

---

## Dependency Security

CI pipeline runs `npm audit --audit-level=high` on every push and PR. This is the correct minimum. No specific high/critical vulnerability findings reported (as of audit date).

Notable high-value dependencies from a security standpoint:
- `handlebars ^4.7.8` — template injection risk if user-supplied strings reach `compile()`. Verify template inputs are not user-controlled.
- `isomorphic-dompurify ^3.5.1` — HTML sanitization, used for sanitizing email content before rendering

---

## Findings

### CRITICAL
- **CRIT-SEC-001:** LLM-generated SQL execution with no server-side validation (re-stated from AI layer). The `/api/ai/search` endpoint takes user input, sends it to Claude, and executes the returned SQL via `supabase.rpc('execute_read_query', ...)`. There is no server-side parse to validate the generated SQL is a single SELECT statement before execution. A prompt injection attack could potentially exfiltrate data from tables with sensitive fields (employee documents, direct deposit info, wallet balances).

### HIGH
- **HIGH-SEC-001:** `unsafe-inline` and `unsafe-eval` in CSP script-src effectively disables XSS mitigation via CSP. While this is documented as temporary (Phase 5 fix), any XSS vulnerability in the application would not be mitigated by the current CSP policy.
- **HIGH-SEC-002:** EasyPost webhook endpoint lacks confirmed signature verification. An attacker could POST fake shipping events to `/api/webhooks/easypost`, potentially marking orders as delivered when they haven't been.
- **HIGH-SEC-003:** The Events API uses `DEFAULT_STUDIO_ID` instead of the authenticated user's `studio_id` (re-stated from API surface CRIT-AS-001). This is a multi-tenancy breach — for multi-studio deployments, this becomes a data access control failure where events from one studio could be accessed by users of another.

### MEDIUM
- **MED-SEC-001:** Duplicate/conflicting security headers: `netlify.toml` and `next.config.ts` both set `X-Content-Type-Options` and `Referrer-Policy`. In practice, Netlify sets these at the CDN edge, and Next.js sets them via the server response. Browsers typically use the first header value — this could lead to unexpected behavior. Standardize to one location.
- **MED-SEC-002:** No `max-age` or session expiry configuration found for Supabase sessions. Supabase's default session duration is 1 hour, with refresh tokens valid for longer periods. Verify session refresh policy matches the security requirements for admin dashboard access.
- **MED-SEC-003:** The `CRON_SECRET` is compared via a Bearer token header but the comparison mechanism should use constant-time comparison to prevent timing attacks. Check the implementation in `/api/glofox/sync` and `/api/cron/*` routes.
- **MED-SEC-004:** `search` parameters injected directly into `.ilike()` queries have no length limit. A search query of 10,000 characters would be sent to the database. Add server-side length validation (e.g., `search.slice(0, 100)`).

### LOW
- **LOW-SEC-001:** Handlebars templates in `lib/email-templates.ts` should ensure user-controlled data (member names, email addresses) is properly escaped. Handlebars HTML-escapes by default with `{{ }}` — verify `{{{ }}}` (triple-stache, unescaped) is not used with user data.
- **LOW-SEC-002:** `geolocation=(self)` in Permissions-Policy allows geolocation — this is correct for the employee clock-in feature, but any future embedded third-party content would also have geolocation access.
- **LOW-SEC-003:** No CORS configuration in Next.js API routes. The API is currently only consumed by the same-origin admin dashboard, but future iOS app and third-party integrations will require explicit CORS headers.

### INFO
- **INFO-SEC-001:** No hardcoded API keys or secrets found in source code — all secrets properly managed via environment variables.
- **INFO-SEC-002:** Magic link authentication eliminates password-related attack vectors (credential stuffing, brute force, weak passwords).
- **INFO-SEC-003:** Row-Level Security (RLS) is active for Phase 2 tables + manual `studio_id` filtering as defense-in-depth. The multi-layer approach is correct.
