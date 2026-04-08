# Layer Report: Integration

**Agent:** integration
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian integrates with 8 external services: Supabase (DB + Auth), Anthropic (AI), Stripe (payments), Resend (email), Twilio (SMS), Inngest (background jobs), Glofox (legacy data sync), and EasyPost (shipping). All integrations follow good patterns: lazy-init singleton clients, server-side only exposure, retry logic for critical paths (Anthropic, Glofox), and webhook signature verification for Stripe and Resend. The primary concerns are: the Glofox sync has no circuit breaker and uses hardcoded constants for namespace/branch; `DEFAULT_STUDIO_ID` is hardcoded in several client files (`'11111111-1111-1111-1111-111111111111'`); and the rate limiter itself uses a Supabase RPC that hasn't been verified to exist in the database.

---

## Integration Inventory

### 1. Supabase (Database + Auth)
- **SDK:** `@supabase/ssr ^0.6.0`, `@supabase/supabase-js ^2.49.0`
- **Pattern:** Three clients: browser client (SSR cookie-based), server client (for route handlers), middleware client (for session refresh)
- **Connection management:** Lazy singleton via `getAnthropicClient()`-style factory functions
- **RLS enforcement:** Anon key used in server routes (RLS active), service-role key used for Inngest/webhooks (bypasses RLS)
- **Error handling:** Supabase client errors are caught at each call site; most return `{ error: "Internal server error" }` with HTTP 500
- **Missing:** No connection pooling configuration, no query timeout settings

### 2. Anthropic (Claude AI)
- **SDK:** `@anthropic-ai/sdk ^0.80.0`
- **Model:** `claude-sonnet-4-6`
- **Pattern:** Lazy singleton with 30s timeout, 3-retry exponential backoff
- **Fallback:** Rules-based fallback in every AI module when key is absent or API fails
- **Error handling:** try-catch + fallback; no structured error telemetry

### 3. Stripe (Payments)
- **SDK:** `stripe ^20.4.1`
- **API version:** `2026-02-25.clover` (very recent API version)
- **Pattern:** Lazy singleton, server-side only
- **Webhook verification:** `constructWebhookEvent()` with signature validation — correct
- **Multi-tenancy:** `meridian_studio_id` stored in Stripe metadata for studio resolution
- **Features used:** Subscriptions, payment intents, proration, customers, webhook events
- **Error handling:** Webhook handler has proper signature verification; Stripe API errors propagate to calling code

### 4. Resend (Email)
- **SDK:** `resend ^6.9.4`
- **Pattern:** Lazy singleton, dry-run mode via `RESEND_DRY_RUN=true`
- **From address:** Falls back to `'The Sauna Guys <noreply@thesaunaguys.com>'` if env var unset — hardcoded default
- **Webhook verification:** Svix library used for Resend webhook verification — correct
- **Features:** Transactional emails, batch sends, campaign sends, unsubscribe tokens
- **Error handling:** `sendTransactionalEmail` returns `{ id, error, dryRun }` — caller must check `error`

### 5. Twilio (SMS)
- **SDK:** `twilio ^5.13.0`
- **Status:** SMS described as "stub" — Twilio imported and configured but not actively sending
- **Pattern:** Provider-agnostic abstraction in `lib/sms/` with Twilio as the concrete provider
- **Rate limiting:** `/api/sms/send` has rate limiting (5/min per user) — correctly protected
- **Error handling:** SMS provider errors handled in the provider wrapper
- **Risk:** `twilio` is a production dependency that adds ~5MB to the server bundle even when unused

### 6. Inngest (Background Jobs)
- **SDK:** `inngest ^4.0.2`
- **Pattern:** Event-driven background processing; 14+ event types defined
- **Signing:** `INNGEST_SIGNING_KEY` enforced in production via console.error warning
- **Functions:** ~19 functions covering crons, automation execution, Glofox write-back
- **Error handling:** Inngest provides built-in retry and error tracking per function
- **Missing:** `INNGEST_SIGNING_KEY` check only logs to console, doesn't throw — a misconfigured key won't stop the server from starting

### 7. Glofox (Legacy Data Sync)
- **Pattern:** Custom REST client in `lib/glofox/client.ts` with pagination, retry (3 attempts, 100ms rate limit delay)
- **Auth:** `x-glofox-api-token` + `x-api-key` headers
- **Mode:** Read-only sync + write-back for bookings/attendance (via Inngest)
- **Hourly sync:** Via `/api/glofox/sync` (CRON_SECRET protected)
- **Error handling:** Retry logic with exponential backoff; sync errors stored in `glofox_sync_conflicts` table; error summary emailed on failure
- **Constants:** `GLOFOX_NAMESPACE` defaults to `'thesaunaguys'` — overrideable but hardcoded fallback

### 8. EasyPost (Shipping)
- **SDK:** Not directly imported — raw webhook processing
- **Status:** Webhook handler exists at `/api/webhooks/easypost` but shipping is "inactive Phase 1"
- **Pattern:** Webhook receives tracking events; no outbound EasyPost API calls confirmed in active code
- **Risk:** Webhook endpoint is registered and protected by middleware but EasyPost webhook verification is not confirmed

---

## Retry and Circuit Breaker Analysis

| Integration | Retry? | Circuit Breaker? | Timeout? |
|-------------|--------|-----------------|---------|
| Anthropic | Yes (3x, exp backoff) | No | 30s |
| Glofox | Yes (3x, 100ms delay) | No | None |
| Stripe | No (SDK defaults) | No | None |
| Resend | No | No | None |
| Twilio | No | No | None |
| Supabase | No | No | None |
| Inngest | Built-in | Built-in | Per-function |

**Gap:** No circuit breakers exist for any third-party integration. If Glofox is down for an extended period, every hourly sync attempt will fail and retry without backing off at the schedule level. If Resend is experiencing issues, campaign sends will return errors with no exponential backoff.

---

## Webhook Verification Matrix

| Service | Verification Method | Status |
|---------|-------------------|--------|
| Stripe | `stripe.webhooks.constructEvent()` signature | Verified |
| Resend | Svix signature verification | Verified |
| Inngest | Inngest signing key | Configured |
| EasyPost | Raw text parsing | Unverified |
| Twilio | Not inspected | Unknown |

---

## Environment Variable Dependencies

| Variable | Required By | Missing = |
|----------|------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase | App breaks |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | All Supabase | Auth breaks |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, Inngest | Admin ops fail |
| `ANTHROPIC_API_KEY` | AI features | Rules-based fallback |
| `STRIPE_SECRET_KEY` | Payments | Payment fails |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook | Webhook rejected |
| `RESEND_API_KEY` | Email sends | Emails fail |
| `INNGEST_SIGNING_KEY` | Background jobs | Jobs unprotected |
| `INNGEST_EVENT_KEY` | Event dispatch | Events fail |
| `GLOFOX_API_KEY/TOKEN` | Glofox sync | Sync disabled |
| `CRON_SECRET` | Cron endpoints | Security gap |
| `DEFAULT_STUDIO_ID` | Multi-tenancy fallback | Uses hardcoded UUID |

---

## Findings

### CRITICAL
None.

### HIGH
- **HIGH-INT-001:** EasyPost webhook (`/api/webhooks/easypost`) processes webhook events without confirmed signature verification. If EasyPost doesn't provide a signing key mechanism or the implementation doesn't verify it, this endpoint could be triggered by any actor to inject fake shipping events.
- **HIGH-INT-002:** The rate limiter calls `supabase.rpc("increment_rate_limit")` — this Supabase RPC must be created via migration before rate limiting works. If the RPC doesn't exist, the rate limiter silently fails open (confirmed in code: `fail-open` pattern). This means rate limiting on AI endpoints is only active if the RPC migration has been applied. There is no validation that the migration ran.

### MEDIUM
- **MED-INT-001:** `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` is hardcoded in `lib/constants.ts`. This default is referenced in Stripe customer creation (`getOrCreateCustomer`) and in some route handlers. For a multi-tenant SaaS deployment, any codepath that falls through to this default will assign Stripe customers and events to the wrong studio.
- **MED-INT-002:** No circuit breaker for Glofox sync. If Glofox API is down for days, hourly sync attempts will continue failing at full rate with no backoff. The Inngest scheduler would continue firing the function every hour.
- **MED-INT-003:** `FROM_ADDRESS` in `lib/resend.ts` falls back to `'The Sauna Guys <noreply@thesaunaguys.com>'` when env vars are absent. For multi-tenant deployments or staging environments, outgoing emails would appear to come from The Sauna Guys' email address.
- **MED-INT-004:** Stripe API version is `'2026-02-25.clover'` — a very recent and non-standard version. Stripe API versions use YYYY-MM-DD format, not semver suffixes. The `.clover` suffix is unusual and may indicate a preview/beta version.

### LOW
- **LOW-INT-001:** `INNGEST_SIGNING_KEY` missing in production only triggers a `console.error` warning — it doesn't prevent the server from starting. A misconfigured key would allow unsigned Inngest function invocations.
- **LOW-INT-002:** Twilio is installed as a production dependency but SMS is described as "stub." The SDK (~5MB) is bundled but only partially used. Should be marked as optional or the imports should be lazy-loaded.
- **LOW-INT-003:** No health check for external services. The `/api/health` endpoint exists but appears to be a simple HTTP 200 response — it doesn't verify Supabase connectivity, Stripe connectivity, etc.

### INFO
- **INFO-INT-001:** The provider-agnostic SMS abstraction in `lib/sms/` is well-designed — swapping Twilio for a different SMS provider would only require changing the provider file.
- **INFO-INT-002:** Resend `DRY_RUN` mode is a well-designed safety valve for staging environments.
- **INFO-INT-003:** Inngest event types are fully typed via `MeridianEvents` — TypeScript will catch incorrect event payloads at compile time.
