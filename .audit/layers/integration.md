# Integration Audit Report

**Agent**: integration
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Integrations examined**: Supabase, Stripe, Anthropic (Claude), Resend, Twilio, Glofox, EasyPost, Inngest, Svix, SnapWidget
- **Files read**: `lib/glofox/client.ts`, `lib/inngest/` (22 files), `lib/sms/` (3 files), `lib/ai/` (14 files), `lib/anthropic.ts`, `lib/resend.ts`, `lib/stripe.ts`, `lib/rate-limit.ts`, `app/api/webhooks/` (4 handlers), `app/api/campaigns/send/route.ts`, `app/api/ai/briefing/route.ts`, `app/api/shipping/rates/route.ts`, `scripts/phase2-migration.sql`, `netlify.toml`
- **Cross-references**: `.audit/layers/api-surface.md` (previous audit findings incorporated)

---

## Executive Summary

The integration layer is ambitious and structurally well-organized: a GlofoxClient with retry + exponential backoff, 19 Inngest functions with proper step isolation, Stripe webhook signature verification, and Resend tracking via Svix. However, there are five findings that require action before production deployment.

The most severe is a **dead automation engine**: the `automation_cooldowns` table schema has a `(member_id, studio_id)` unique key with two timestamp columns (`last_automation_email_at`, `last_automation_sms_at`), but the `helpers.ts` code queries a non-existent `channel` column and upserts on a non-existent `(member_id, studio_id, channel)` constraint. Every cooldown check silently returns `false` (no row found), so every enrolled member will receive automation emails and SMS on every cycle with no rate limiting. This was flagged in a previous audit but remains unresolved.

Two other HIGH issues are confirmed carryovers: the in-memory rate limiter that provides no real protection in serverless, and two webhook handlers (EasyPost, Twilio) that skip signature verification when environment variables are absent.

---

## Findings by Severity

---

### CRITICAL

#### I-C1: `automation_cooldowns` Schema/Code Mismatch — Automation Sends Unbounded

**Files**: `apps/web/src/lib/inngest/helpers.ts:143–175`, `scripts/phase2-migration.sql:344–356`

The `phase2-migration.sql` schema creates `automation_cooldowns` with two timestamp columns and a unique constraint on `(member_id, studio_id)`:

```sql
CREATE TABLE automation_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,
  last_automation_email_at TIMESTAMPTZ,
  last_automation_sms_at TIMESTAMPTZ,
  UNIQUE(member_id, studio_id)
);
```

The application code (`helpers.ts`) queries a `channel` column and upserts on `(member_id, studio_id, channel)`:

```typescript
// checkAutomationCooldown — queries a non-existent column
const { data } = await db
  .from('automation_cooldowns')
  .select('last_sent_at')
  .eq('member_id', memberId)
  .eq('studio_id', studioId)
  .eq('channel', channel)   // column does not exist in schema
  .single();

// updateCooldown — upserts with non-existent conflict target
await db.from('automation_cooldowns').upsert(
  { member_id: memberId, studio_id: studioId, channel, last_sent_at: now },
  { onConflict: 'member_id,studio_id,channel' },  // constraint does not exist
);
```

**Impact**: `checkAutomationCooldown` will always return `false` (no row matched because the `channel` filter matches nothing). `updateCooldown` will silently fail or insert a dangling row. The 24-hour per-channel cooldown that prevents automation spam is entirely non-functional. Every automation enrollment will send email and SMS steps on every trigger evaluation cycle with no throttling.

**Fix**: Either migrate the schema to add a `channel TEXT NOT NULL` column and change the unique constraint to `(member_id, studio_id, channel)`, or rewrite `helpers.ts` to use the existing `last_automation_email_at` / `last_automation_sms_at` columns.

---

### HIGH

#### I-H1: In-Memory Rate Limiter Is Inoperative in Serverless (Confirmed Carryover)

**File**: `apps/web/src/lib/rate-limit.ts`

The limiter stores state in a module-level `Map`. In Netlify serverless, each invocation runs in an isolated context with no shared memory. The file's own comment acknowledges this limitation. The limiter is applied to:

- All 13 AI endpoints: `rateLimit(`ai:${user.id}`, 20, 60_000)` — intended to cap Anthropic spend
- The leads capture endpoint: `rateLimit(ip, 10, 60_000)` — intended to prevent form spam

Neither limit is enforced in production. At typical Netlify concurrency, a single authenticated user can invoke any AI endpoint without throttling, creating unbounded Anthropic API spend exposure.

**Fix**: Replace with an upstash/redis or Netlify Blob-backed implementation before launching any AI feature to external users.

---

#### I-H2: EasyPost Webhook Skips HMAC Verification When `EASYPOST_WEBHOOK_SECRET` Is Unset

**File**: `apps/web/src/app/api/webhooks/easypost/route.ts:17–55`

```typescript
if (webhookSecret) {
  // ...verify HMAC...
  return await handleEvent(event)
}
// No secret configured — parse body directly (development mode)
const event = await request.json()
return await handleEvent(event)
```

When `EASYPOST_WEBHOOK_SECRET` is not set, the handler accepts and processes any JSON body sent to `POST /api/webhooks/easypost` without authentication. An attacker who knows the endpoint URL can forge order delivery events (`tracker.updated` with `status: "delivered"`) to mark orders as delivered in the database without them actually being shipped.

**Fix**: Require `EASYPOST_WEBHOOK_SECRET` unconditionally. Return 503 or 401 at startup/runtime if the variable is absent, rather than falling back to unauthenticated mode.

---

#### I-H3: Twilio Webhook Skips Signature Verification When `TWILIO_AUTH_TOKEN` Is Unset

**File**: `apps/web/src/app/api/webhooks/twilio/route.ts:13–46`

The Twilio request signature is only validated when `TWILIO_AUTH_TOKEN` is present:

```typescript
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (authToken) {
  // ...validateRequest...
}
// Falls through without verification when authToken is unset
```

Without verification, anyone can POST to `POST /api/webhooks/twilio` to fake opt-out events, fake delivery confirmations, or inject inbound SMS payloads that the automation engine will act on.

**Fix**: Require `TWILIO_AUTH_TOKEN` to be set when `SMS_PROVIDER=twilio`. If absent, return 500 on startup or a 503 on the webhook endpoint with a clear error message rather than silently accepting unsigned requests.

---

#### I-H4: Stripe Webhook Handler Has No Idempotency Guard

**File**: `apps/web/src/app/api/webhooks/stripe/route.ts`

Stripe guarantees at-least-once delivery and explicitly recommends checking whether an event has already been processed. The current handler has no such check. For `invoice.payment_succeeded`, each duplicate delivery inserts a new row in `transactions`:

```typescript
case 'invoice.payment_succeeded': {
  await supabase.from('transactions').insert({ ... })  // no existence check
```

For `checkout.session.completed`, each duplicate inserts a new `credit_packs` or `gift_cards` row, potentially crediting a member twice.

**Fix**: Record processed Stripe event IDs in a `processed_stripe_events` table (or check for an existing transaction with the same `stripe_payment_intent_id`) before inserting. The standard pattern is:

```typescript
const existing = await supabase
  .from('processed_stripe_events')
  .select('id')
  .eq('event_id', event.id)
  .maybeSingle();
if (existing.data) return NextResponse.json({ received: true });
// ...process event...
// insert event_id after successful processing
```

---

#### I-H5: Glofox Write-back Enabled — Violates Read-Only Policy

**Files**: `apps/web/src/lib/inngest/functions/glofox-create-booking.ts`, `apps/web/src/lib/inngest/functions/glofox-cancel-booking.ts`, `apps/web/src/lib/inngest/functions/glofox-mark-attendance.ts`, `apps/web/src/lib/glofox/client.ts:315–369`

The project's own memory file (`MEMORY.md`) states: "Never write to Glofox in tests or code until explicitly approved; reads only."

Three active Inngest functions (`glofox-create-booking`, `glofox-cancel-booking`, `glofox-mark-attendance`) perform write operations against the live Glofox API. These functions are registered in the serve endpoint and will execute when their trigger events are fired. The `GlofoxClient` also exposes `registerMember`, `updateMember`, `purchaseMembership`, `cancelMembership`, `createInteraction`, and `sendAgreement` — all write methods.

**Impact**: Any booking or check-in action in the Meridian UI will fire Inngest events that call back into the live Glofox system. This is the opposite of the documented integration strategy (Meridian as source of truth, Glofox as read-only sync source).

**Fix**: Either (a) remove the three write-back functions from the `functions` registry until they are explicitly approved, or (b) gate the event sends behind a `GLOFOX_WRITE_BACK_ENABLED=true` environment variable that defaults to false.

---

### MEDIUM

#### I-M1: Hardcoded Glofox Analytics Namespace in Sync Functions

**Files**: `apps/web/src/lib/inngest/functions/glofox-backfill.ts:372`, `apps/web/src/lib/inngest/functions/glofox-sync-hourly.ts:300`, `apps/web/src/lib/inngest/functions/glofox-sync-manual.ts:274`

All three Glofox sync functions call `glofox.getTransactions(BRANCH_ID, 'thesaunaguys', ...)` with the studio namespace hardcoded as the string literal `'thesaunaguys'`. This is distinct from `GLOFOX_BRANCH_ID` (which is an env var). When Meridian is sold as a SaaS product to other studios, every new tenant's sync will query The Sauna Guys' transaction analytics.

**Fix**: Add a `GLOFOX_NAMESPACE` environment variable and use it in place of the hardcoded string.

---

#### I-M2: Stripe `studio_id` Hardcoded in `lib/stripe.ts`

**File**: `apps/web/src/lib/stripe.ts:37, 120`

Both `getOrCreateCustomer` and `createPaymentIntent` embed the hardcoded test UUID `'11111111-1111-1111-1111-111111111111'` as `studio_id` in Stripe metadata:

```typescript
metadata: {
  meridian_member_id: memberId,
  studio_id: '11111111-1111-1111-1111-111111111111',
}
```

The Stripe webhook handler uses `metadata.meridian_studio_id` (note: different key name — `meridian_studio_id` vs `studio_id`) for lookups. This means the fallback lookup path is always invoked (the member DB lookup), and a production multi-tenant deployment would silently associate all Stripe customers with the wrong studio.

**Fix**: Pass `studioId` as a parameter to `getOrCreateCustomer` and `createPaymentIntent`. Use the key name `meridian_studio_id` (matching the webhook handler's lookup key) instead of `studio_id`.

---

#### I-M3: No `.env.example` File Exists

No `.env.example`, `.env.template`, or equivalent documentation of required environment variables exists in the repository. Required variables scattered across the codebase include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_DRY_RUN`
- `EMAIL_FROM_ADDRESS` / `RESEND_FROM_ADDRESS`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `TWILIO_STATUS_CALLBACK_URL`
- `SMS_PROVIDER`
- `GLOFOX_API_TOKEN`, `GLOFOX_API_KEY`, `GLOFOX_BRANCH_ID`
- `GLOFOX_STUDIO_ID`
- `DEFAULT_STUDIO_ID`
- `EASYPOST_API_KEY`, `EASYPOST_WEBHOOK_SECRET`
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` (implied, not found in source)

A new developer or a new Netlify deployment cannot self-configure the application without spelunking through the source. The `netlify.toml` only declares `NODE_VERSION`.

**Fix**: Create `apps/web/.env.example` listing every variable with comments describing purpose and whether it is optional.

---

#### I-M4: Anthropic API Calls Have No Timeout Configuration

**File**: `apps/web/src/lib/ai/client.ts`, all 13 AI route handlers

The Anthropic client is initialized with no timeout:

```typescript
_client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

All 13 AI endpoints call `anthropic.messages.create(...)` with no `signal` or timeout wrapper. The Anthropic Node SDK default timeout is 600 seconds. A slow or hanging LLM response will hold a Netlify function open for up to 10 minutes, blocking the client UI and consuming serverless function execution time.

**Fix**: Pass a timeout when initializing the client: `new Anthropic({ apiKey: ..., timeout: 30_000 })`. Additionally, the briefing endpoint already has a 30-minute DB cache — this mitigates the user-visible impact but does not protect against the function-hang scenario on cache miss.

---

#### I-M5: Inngest Functions Use Single-Tenant Hardcoded Studio IDs

**Files**: 10 Inngest cron functions in `lib/inngest/functions/`

Every cron function (daily metrics, cohort refresh, trainer metrics, AI insights, report scheduler, export cleanup, payroll reminder, invoice overdue, contract expiry, corporate credits, and the trigger evaluator) hardcodes the studio UUID with:

```typescript
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || '11111111-1111-1111-1111-111111111111';
```

The fallback to the test UUID means that if `DEFAULT_STUDIO_ID` is not set in production, all background jobs silently process data for the test studio and produce no output for the real studio. The TODO comments in the files acknowledge this (`// TODO: Multi-tenancy — query studios table and iterate all active studios`), but as a Phase 1 deployment risk it requires the environment variable to be explicitly set.

This is also a blocker for SaaS multi-tenancy: none of the cron jobs iterate across studios.

---

#### I-M6: Campaign Send Route Uses Hardcoded `STUDIO_ID`

**File**: `apps/web/src/app/api/campaigns/send/route.ts:7`

```typescript
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
```

The campaign send handler is one of the highest-value actions in the system (it sends real emails to real members via Resend). It resolves member profiles and writes to `campaigns` and `campaign_recipients` filtered by this hardcoded ID rather than the authenticated user's studio. This means campaigns sent by any studio owner will query and write to the test studio.

**Fix**: Extract studio ID from the authenticated user's profile (pattern used by all routes that call `requireRole()`).

---

#### I-M7: EasyPost `from_address` Hardcoded with Placeholder Data

**File**: `apps/web/src/app/api/shipping/rates/route.ts:92–99`

```typescript
const fromAddress = {
  name: 'The Sauna Guys',
  street1: '123 Main St',
  city: 'Tampa',
  state: 'FL',
  zip: '33601',
  country: 'US',
}
```

This is submitted to the live EasyPost API when `EASYPOST_API_KEY` is set. Using `123 Main St` as the origin address will produce inaccurate shipping rates and invalid labels. There is no fallback or validation. This data should come from the studio's settings table.

---

### LOW

#### I-L1: Twilio Batch Sends Use Sequential `setTimeout` Delay Instead of Proper Rate Limiting

**File**: `apps/web/src/lib/sms/providers/twilio.ts:78`

```typescript
await new Promise((resolve) => setTimeout(resolve, 100));
```

The 100ms inter-message delay in `sendBatch` is a crude approximation of Twilio's rate limits. Twilio's default rate varies by account tier (1 msg/sec on trial, up to 100/sec on high-throughput). For large batches, this introduces unnecessary latency without accurately matching the account's actual limits. There is no error handling for `429` responses from Twilio.

---

#### I-L2: Resend `sendBatchEmails` Aborts Entire Batch on First Chunk Error

**File**: `apps/web/src/lib/resend.ts:163–171`

```typescript
if (error) {
  return { ids: allIds, error: error.message, dryRun: false }
}
```

If chunk 2 of a 300-email batch fails, chunks 3+ are abandoned with no retry and no record of which emails were not sent. Combined with the SSE streaming in `campaigns/send/route.ts`, this can leave a campaign in an inconsistent state where some members received the email and others did not, with no log of who was skipped. The per-recipient `campaign_recipients` row exists only for members that were processed, so the omitted members leave no trace.

---

#### I-L3: Glofox Client Singleton Is Not Reset Between Inngest Function Invocations

**File**: `apps/web/src/lib/glofox/client.ts:772–779`

```typescript
let _client: GlofoxClient | null = null;

export function getGlofoxClient(): GlofoxClient {
  if (!_client) { _client = new GlofoxClient() }
  return _client;
}
```

The Inngest backfill and sync functions instantiate their own `new GlofoxClient()` directly (not via `getGlofoxClient()`), so this singleton is unused in those paths. However, any route handler that calls `getGlofoxClient()` will share a module-level singleton across Netlify function invocations within the same container. This is benign for the current read-only patterns but would become a credential-sharing risk if different studios used different Glofox credentials in a future multi-tenant configuration.

---

#### I-L4: Email Templates Hardcode `thesaunaguys.com` URLs

**File**: `apps/web/src/lib/email-templates.ts:35, 147, 176, 178`

Unsubscribe links, booking CTAs, email preferences links, and privacy policy links in the shared email layout template all point to `https://thesaunaguys.com/...`. These are hard-coded into the layout wrapper used by every campaign and automation email. Any other studio using Meridian would send emails with The Sauna Guys' links.

**Fix**: Pass studio URL/domain as a parameter to `wrapEmailLayout`, sourced from the studio's settings table.

---

#### I-L5: Inngest Serve Endpoint Has No Signing Key Configured

**File**: `apps/web/src/app/api/inngest/route.ts`

```typescript
export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

No `signingKey` is passed to `serve()`. Inngest requires `INNGEST_SIGNING_KEY` to authenticate that function invocation requests come from Inngest's infrastructure. Without it, anyone who can discover the `/api/inngest` endpoint URL can trigger arbitrary Inngest functions (backfills, automation flows, cron jobs) by posting correctly-formatted payloads. Inngest's documentation marks this as required for production. The variable was also not found in any config files.

**Fix**: Set `INNGEST_SIGNING_KEY` in the deployment environment (Netlify environment variables). The Inngest SDK will automatically pick it up from `process.env.INNGEST_SIGNING_KEY` without any code change.

---

#### I-L6: No Health Check Endpoint for External Dependencies

There is no `GET /api/health` or equivalent endpoint that checks the connectivity of external services. Netlify, monitoring tools, and load balancers cannot distinguish between an application that is healthy and one where Supabase is unreachable, Stripe credentials are misconfigured, or Anthropic is down.

**Fix**: Implement a lightweight health endpoint that performs a shallow check on each critical dependency (Supabase connection, Stripe API key validity) and returns a structured JSON response with per-service status.

---

#### I-L7: No Error Monitoring Integration

No Sentry, Datadog, Bugsnag, or equivalent error tracking SDK is installed or imported. All errors are logged to `console.error`. In a Netlify serverless environment, console output is ephemeral — logs are visible in the Netlify dashboard but not aggregated, not alertable, and not correlated across requests. A production AI call failure, Stripe webhook error, or Inngest function crash will produce no alert.

---

## Integration Health Matrix

| Integration | Client Setup | Error Handling | Retry Logic | Timeout | Webhook Auth | Idempotency |
|---|---|---|---|---|---|---|
| Supabase (cookie) | Good | Good | None | None (SDK) | N/A | N/A |
| Supabase (service role) | Good | Partial | None | None (SDK) | N/A | N/A |
| Stripe | Good | Good | None (SDK handles) | None | Strong (required sig) | Missing |
| Anthropic | Good | Fallback to rules | None (SDK default) | None set | N/A | DB cache (30min) |
| Resend | Good | Partial | None | None | Strong (Svix required) | Partial (per-recipient) |
| Twilio | Good | Good | None | None | Conditional (env-gated) | None |
| Glofox Client | Good | Good | 3 retries + backoff | None | N/A | upsert on glofox_id |
| Glofox Sync (Inngest) | Good | Good | 2–3 retries | None | N/A | upsert on conflict |
| EasyPost | Partial (dynamic import) | Good | None | None | Conditional (env-gated) | None |
| Inngest (serve) | Good | onFailure hooks | Per-function config | N/A | Missing signing key | Inngest dedup |

---

## Configuration Management Assessment

**Environment variable documentation**: None. No `.env.example` exists. Required variables must be discovered by reading source code.

**Secret separation**: All secrets are environment variables. No secrets are hardcoded in source with the exception of:
- Two hardcoded studio UUIDs in `lib/stripe.ts` (functional bug, not a secret leak)
- Hardcoded Glofox analytics namespace `'thesaunaguys'` in three sync functions
- Hardcoded `from_address` in EasyPost shipping rates

**Build-time vs runtime**: All secret access uses `process.env` at request time, not at build time. Lazy initialization (`let _client = null`) prevents build failures when env vars are absent.

**Missing required variables (none documented)**:
- `INNGEST_SIGNING_KEY` — not found in any config file; Inngest production security depends on it
- `DEFAULT_STUDIO_ID` — all cron jobs fall back to test UUID without it
- `GLOFOX_STUDIO_ID` — the hourly sync uses `process.env.GLOFOX_STUDIO_ID!` (non-null assertion)

---

## Data Consistency Analysis

### Stripe → Supabase sync

Stripe events update `members.membership_status` via webhook. There is no optimistic lock or version check. If Stripe delivers the same event twice (which it guarantees it may), two concurrent invocations could insert duplicate `transactions` rows (I-H4). The `customer.subscription.updated` handler is idempotent by nature (it just sets a status), but the `invoice.payment_succeeded` insert is not.

### Glofox → Supabase sync (read side)

The incremental hourly sync uses `upsert` with `onConflict: 'glofox_id,studio_id'` throughout. This is correct and idempotent. The backfill correctly processes entities in dependency order (staff → members → events → bookings → transactions → credits → leads → plans) to satisfy foreign key constraints.

### Meridian → Glofox write-back

The write-back Inngest functions are fire-and-forget. Supabase is updated first; Glofox write-back is async. On failure (after 3 retries), the conflict is logged to `glofox_sync_conflicts` and the `bookings.glofox_write_status` is set to `'failed'`. The booking exists in Meridian but not in Glofox. The next hourly sync would not create it in Meridian (it already exists), but would not push it to Glofox either. This creates a permanent one-way gap with no automatic reconciliation path.

### Automation cooldowns

As described in I-C1, the cooldown system is entirely broken due to the schema/code mismatch. Automation flows will send to members on every trigger evaluation with no rate limiting.

---

## Missing Integrations

The following features are documented or implied but have no backing integration:

| Feature | Status | Risk |
|---|---|---|
| SMS campaigns | Stubbed — `StubProvider` logs to console | All SMS sends succeed silently with no real delivery |
| Twilio delivery tracking → DB | Webhook parses status but only logs to console; no DB write | SMS delivery rates are untracked |
| EasyPost label creation (`/api/orders/[id]/ship`) | Not examined in detail; `EASYPOST_API_KEY` gates between real and stub | Shipping labels may not be created in production |
| Stripe Apple Pay / Google Pay | `createCheckoutSession` hardcodes `payment_method_types: ['card']` | Apple/Google Pay will not appear at checkout despite being a documented feature |
| Push notifications | Phase 5 planned; no SDK present | N/A for Phase 1 |
| pgvector AI search | Package not installed; `/api/ai/search` exists but no vector embeddings pipeline | AI search endpoint likely returns empty results |

---

## Diagram

Written to `.audit/diagrams/integration.mmd`

Legend:
- Green: healthy integration with error handling
- Yellow: missing timeout or conditional auth
- Red: security bypass when env var absent
- Gray: embed only, no backend dependency
